import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, User, Briefcase, Star } from "lucide-react";
import { toast } from "sonner";

export interface FeedbackEntry {
  id: string;
  feedback_text: string;
  rating: number | null;
  submitted_at: string;
  submitted_by: string;
  job_id: string;
  job_title: string;
  author_name: string;
}

interface JobOption {
  id: string;
  title: string;
}

interface Props {
  candidateId: string;
  companyId: string;
  userId: string;
  jobs: JobOption[];
  defaultJobId?: string;
}

export default function InterviewFeedback({ candidateId, companyId, userId, jobs, defaultJobId }: Props) {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string>(defaultJobId ?? jobs[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const fetchFeedback = async () => {
    const { data, error } = await (supabase as any)
      .from("interview_feedback")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as any[];
    const userIds = [...new Set(rows.map((r) => r.submitted_by))];
    const jobIds = [...new Set(rows.map((r) => r.job_id))];

    const [profilesRes, jobsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, name").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("jobs").select("id, title").in("id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const authorMap: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p: any) => (authorMap[p.user_id] = p.name));
    const jobMap: Record<string, string> = {};
    (jobsRes.data ?? []).forEach((j: any) => (jobMap[j.id] = j.title));

    setFeedback(
      rows.map((r) => ({
        id: r.id,
        feedback_text: r.feedback_text,
        rating: r.rating,
        submitted_at: r.submitted_at,
        submitted_by: r.submitted_by,
        job_id: r.job_id,
        job_title: jobMap[r.job_id] ?? "Unknown position",
        author_name: authorMap[r.submitted_by] ?? "Unknown",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const submit = async () => {
    if (!text.trim()) return;
    if (!jobId) {
      toast.error("Please select a position");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("interview_feedback").insert({
      candidate_id: candidateId,
      job_id: jobId,
      company_id: companyId,
      feedback_text: text.trim(),
      rating,
      submitted_by: userId,
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success("Feedback submitted");
    setText("");
    setRating(null);
    await fetchFeedback();
    setSaving(false);
  };

  return (
    <div
      className="bg-card border rounded-xl p-6 space-y-5"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Interview Feedback
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {feedback.length} {feedback.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Submission form */}
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <Select value={jobId} onValueChange={setJobId} disabled={jobs.length === 0}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={jobs.length === 0 ? "No positions available" : "Select position"} />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id} className="text-sm">
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Rating (optional)</label>
            <div className="flex items-center gap-1 h-9">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className="p-1 hover:scale-110 transition-transform"
                  aria-label={`Rate ${n} stars`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      rating && n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your interview feedback (strengths, concerns, recommendation...)"
          rows={4}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!text.trim() || !jobId || saving} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {saving ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </div>

      {/* Feedback list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">Loading feedback...</p>
        ) : feedback.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No feedback yet. Submit your first interview evaluation above.
          </p>
        ) : (
          feedback.map((f) => (
            <div key={f.id} className="border rounded-lg p-4 bg-background">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <User className="w-3.5 h-3.5" />
                    {f.author_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {f.job_title}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(f.submitted_at).toLocaleString()}
                  </span>
                </div>
                {f.rating != null && (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3.5 h-3.5 ${
                          n <= f.rating!
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{f.feedback_text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
