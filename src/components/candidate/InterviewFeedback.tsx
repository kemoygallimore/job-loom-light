import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Clock, Plus, User, Briefcase, UserCheck, Calendar, Star } from "lucide-react";
import StarRating from "@/components/feedback/StarRating";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  feedback_date: string | null;
  author_name: string;
  strengths: string | null;
  opportunities: string | null;
  weaknesses: string | null;
  rating: number | null;
  source: string | null;
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
  const [feedbackBy, setFeedbackBy] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [strengths, setStrengths] = useState("");
  const [opportunities, setOpportunities] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [rating, setRating] = useState(0);

  // Edit/delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    feedback_text: "",
    feedback_by: "",
    feedback_date: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startEdit = (f: FeedbackEntry) => {
    setEditingId(f.id);
    setEditDraft({
      feedback_text: f.feedback_text,
      feedback_by: f.feedback_by ?? "",
      feedback_date: f.feedback_date ?? todayISO(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.feedback_text.trim()) {
      toast.error("Feedback cannot be empty");
      return;
    }
    setSavingEdit(true);
    const { error } = await (supabase as any)
      .from("interview_feedback")
      .update({
        feedback_text: editDraft.feedback_text.trim(),
        feedback_by: editDraft.feedback_by.trim() || null,
        feedback_date: editDraft.feedback_date || null,
      })
      .eq("id", id);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feedback updated");
    setEditingId(null);
    await fetchFeedback();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("interview_feedback").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feedback deleted");
    setDeleteId(null);
    await fetchFeedback();
  };

  // Auto-populated from latest job
  const activeJob = jobs.find((j) => j.id === defaultJobId) ?? jobs[0];
  const position = activeJob?.title ?? "—";
  const hiringManager = activeJob?.hiring_manager ?? "—";

  useEffect(() => {
    if (currentUserName && !feedbackBy) setFeedbackBy(currentUserName);
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
    (jobsRes.data ?? []).forEach((j: any) => (jobMap[j.id] = { title: j.title, hiring_manager: j.hiring_manager }));

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
        feedback_date: r.feedback_date ?? null,
        author_name: authorMap[r.submitted_by] ?? "Unknown",
        strengths: r.strengths ?? null,
        opportunities: r.opportunities ?? null,
        weaknesses: r.weaknesses ?? null,
        rating: r.rating ?? null,
        source: r.source ?? "internal",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const submit = async () => {
    if (!feedbackBy.trim()) {
      toast.error("Please fill in Feedback done by");
      return;
    }
    if (!strengths.trim()) {
      toast.error("Please describe at least the candidate's strengths");
      return;
    }
    if (rating === 0) {
      toast.error("Please select an overall rating");
      return;
    }
    if (!activeJob) {
      toast.error("No position available to attach feedback to");
      return;
    }
    const composedText = [
      strengths.trim() && `STRENGTHS:\n${strengths.trim()}`,
      opportunities.trim() && `OPPORTUNITIES:\n${opportunities.trim()}`,
      weaknesses.trim() && `WEAKNESSES:\n${weaknesses.trim()}`,
    ].filter(Boolean).join("\n\n");
    setSaving(true);
    const { error } = await (supabase as any).from("interview_feedback").insert({
      candidate_id: candidateId,
      job_id: activeJob.id,
      company_id: companyId,
      feedback_text: composedText,
      feedback_by: feedbackBy.trim(),
      feedback_date: feedbackDate,
      hiring_manager: activeJob.hiring_manager ?? null,
      submitted_by: userId,
      strengths: strengths.trim() || null,
      opportunities: opportunities.trim() || null,
      weaknesses: weaknesses.trim() || null,
      rating,
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success("Feedback submitted");
    setFeedbackBy("");
    setFeedbackDate(todayISO());
    setStrengths("");
    setOpportunities("");
    setWeaknesses("");
    setRating(0);
    await fetchFeedback();
    setSaving(false);
  };

  return (
    <div className="bg-card border rounded-xl p-6 space-y-5" style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interview Feedback</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {feedback.length} {feedback.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Submission form — templated */}
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Feedback from</label>
            <Input
              value={feedbackBy}
              onChange={(e) => setFeedbackBy(e.target.value)}
              placeholder="e.g. John Smith (Interviewer)"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Interview Date</label>
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
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Strengths</label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="What did the candidate do well?" rows={3} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Opportunities</label>
            <Textarea value={opportunities} onChange={(e) => setOpportunities(e.target.value)} placeholder="Areas where they could grow" rows={3} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Weaknesses</label>
            <Textarea value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} placeholder="Concerns or weaknesses" rows={3} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Overall rating</label>
            <StarRating value={rating} onChange={setRating} size={22} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={submit}
            disabled={!strengths.trim() || rating === 0 || !feedbackBy.trim() || saving}
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
                  <span className="font-medium text-foreground">Feedback From:</span>
                  <span>{f.feedback_by ?? f.author_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground"> Interview Date:</span>
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
              {(f.rating || f.source === "guest") && (
                <div className="flex items-center justify-between pt-1 border-t">
                  {f.rating ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">Rating:</span>
                      <StarRating value={f.rating} readOnly size={14} />
                    </div>
                  ) : <span />}
                  {f.source === "guest" && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                      Guest panelist
                    </span>
                  )}
                </div>
              )}
              {f.strengths && (
                <div className="text-sm pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Strengths</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{f.strengths}</p>
                </div>
              )}
              {f.opportunities && (
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Opportunities</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{f.opportunities}</p>
                </div>
              )}
              {f.weaknesses && (
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Weaknesses</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{f.weaknesses}</p>
                </div>
              )}
              {!f.strengths && !f.opportunities && !f.weaknesses && f.feedback_text && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed pt-1 border-t">{f.feedback_text}</p>
              )}
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
