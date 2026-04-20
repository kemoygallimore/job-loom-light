import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Clock, Plus, User, Briefcase, UserCheck, Calendar } from "lucide-react";
import { toast } from "sonner";

export interface FeedbackEntry {
  id: string;
  feedback_text: string;
  submitted_at: string;
  submitted_by: string;
  job_id: string;
  job_title: string;
  hiring_manager: string | null;
  feedback_by: string | null;
  recruiter_name: string | null;
  feedback_date: string | null;
  author_name: string;
}

interface JobOption {
  id: string;
  title: string;
  hiring_manager?: string | null;
}

interface Props {
  candidateId: string;
  companyId: string;
  userId: string;
  jobs: JobOption[];
  defaultJobId?: string;
  currentUserName?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function InterviewFeedback({
  candidateId,
  companyId,
  userId,
  jobs,
  defaultJobId,
  currentUserName,
}: Props) {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [feedbackBy, setFeedbackBy] = useState("");
  const [recruiterName, setRecruiterName] = useState(currentUserName ?? "");
  const [feedbackDate, setFeedbackDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  // Auto-populated from latest job
  const activeJob = jobs.find((j) => j.id === defaultJobId) ?? jobs[0];
  const position = activeJob?.title ?? "—";
  const hiringManager = activeJob?.hiring_manager ?? "—";

  useEffect(() => {
    if (currentUserName && !recruiterName) setRecruiterName(currentUserName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserName]);

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
    const jobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))];

    const [profilesRes, jobsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, name").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      jobIds.length
        ? supabase.from("jobs").select("id, title, hiring_manager").in("id", jobIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const authorMap: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p: any) => (authorMap[p.user_id] = p.name));
    const jobMap: Record<string, { title: string; hiring_manager: string | null }> = {};
    (jobsRes.data ?? []).forEach(
      (j: any) => (jobMap[j.id] = { title: j.title, hiring_manager: j.hiring_manager }),
    );

    setFeedback(
      rows.map((r) => ({
        id: r.id,
        feedback_text: r.feedback_text,
        submitted_at: r.submitted_at,
        submitted_by: r.submitted_by,
        job_id: r.job_id,
        job_title: jobMap[r.job_id]?.title ?? "Unknown position",
        hiring_manager: r.hiring_manager ?? jobMap[r.job_id]?.hiring_manager ?? null,
        feedback_by: r.feedback_by ?? null,
        recruiter_name: r.recruiter_name ?? null,
        feedback_date: r.feedback_date ?? null,
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
    if (!feedbackBy.trim() || !recruiterName.trim()) {
      toast.error("Please fill in Feedback by and Recruiter name");
      return;
    }
    if (!activeJob) {
      toast.error("No position available to attach feedback to");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("interview_feedback").insert({
      candidate_id: candidateId,
      job_id: activeJob.id,
      company_id: companyId,
      feedback_text: text.trim(),
      feedback_by: feedbackBy.trim(),
      recruiter_name: recruiterName.trim(),
      feedback_date: feedbackDate,
      hiring_manager: activeJob.hiring_manager ?? null,
      submitted_by: userId,
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success("Feedback submitted");
    setText("");
    setFeedbackBy("");
    setFeedbackDate(todayISO());
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

      {/* Submission form — templated */}
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Feedback by</label>
            <Input
              value={feedbackBy}
              onChange={(e) => setFeedbackBy(e.target.value)}
              placeholder="e.g. John Smith (Interviewer)"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Recruiter name</label>
            <Input
              value={recruiterName}
              onChange={(e) => setRecruiterName(e.target.value)}
              placeholder="Recruiter name"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={feedbackDate}
              onChange={(e) => setFeedbackDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hiring Manager</label>
            <Input value={hiringManager} disabled className="h-9 text-sm bg-background" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Position</label>
            <Input value={position} disabled className="h-9 text-sm bg-background" />
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
          <Button
            onClick={submit}
            disabled={!text.trim() || !feedbackBy.trim() || !recruiterName.trim() || saving}
            size="sm"
            className="gap-1.5"
          >
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
            <div key={f.id} className="border rounded-lg p-4 bg-background space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">Feedback by:</span>
                  <span>{f.feedback_by ?? f.author_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">Recruiter:</span>
                  <span>{f.recruiter_name ?? f.author_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">Date:</span>
                  <span>
                    {f.feedback_date
                      ? new Date(f.feedback_date).toLocaleDateString()
                      : new Date(f.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">Hiring Manager:</span>
                  <span>{f.hiring_manager ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground sm:col-span-2">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">Position:</span>
                  <span>{f.job_title}</span>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed pt-1 border-t">
                {f.feedback_text}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
                <Clock className="w-3 h-3" />
                Submitted {new Date(f.submitted_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
