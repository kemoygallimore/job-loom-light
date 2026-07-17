import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import StarRating from "@/components/feedback/StarRating";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface LinkContext {
  id: string;
  company_id: string;
  candidate_id: string;
  job_id: string;
  expires_at: string;
  candidate_name: string;
  job_title: string;
  hiring_manager: string | null;
}

export default function PublicFeedback() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<LinkContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [feedbackBy, setFeedbackBy] = useState("");
  const [scorecardVersionId, setScorecardVersionId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Array<{ id: string; label: string; description: string | null }>>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data: context, error: contextError } = await (supabase as any)
        .rpc("get_public_feedback_context", { _token: token })
        .maybeSingle();

      if (contextError || !context) {
        setError("This feedback link is invalid, expired, or no longer available.");
        setLoading(false);
        return;
      }

      setCtx({
        id: context.id,
        company_id: context.company_id,
        candidate_id: context.candidate_id,
        job_id: context.job_id,
        expires_at: context.expires_at,
        candidate_name: context.candidate_name ?? "Candidate",
        job_title: context.job_title ?? "Position",
        hiring_manager: context.hiring_manager ?? null,
      });

      const { data: version } = await supabase.from("interview_scorecard_versions").select("id").eq("company_id", context.company_id).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
      if (version) { const { data: areaRows } = await supabase.from("interview_scorecard_areas").select("id, label, description").eq("version_id", version.id).order("position"); setScorecardVersionId(version.id); setAreas(areaRows ?? []); }
      setLoading(false);
    };
    load();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    if (!feedbackBy.trim() || !summary.trim() || areas.length < 2 || areas.some((area) => !ratings[area.id])) {
      toast.error("Please enter your name, rate every area, and add a summary");
      return;
    }
    setSubmitting(true);
    const average = Number((areas.reduce((sum, area) => sum + ratings[area.id], 0) / areas.length).toFixed(2));
    const snapshot = { areas, scale: ["Poor", "Below expectations", "Meets expectations", "Exceeds expectations", "Exceptional"] };

    const { error: insertErr } = await (supabase as any).rpc("submit_public_feedback", {
      _token: token ?? "",
      _feedback_by: feedbackBy.trim(),
      _summary: summary.trim(),
      _ratings: ratings,
      _scorecard_version_id: scorecardVersionId,
      _scorecard_snapshot: snapshot,
      _panelist_average: average,
    });
    setSubmitting(false);
    if (insertErr) {
      toast.error(insertErr.message);
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (error || !ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{error ?? "This link is no longer valid."}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-lg font-semibold">Thank you!</h1>
          <p className="text-sm text-muted-foreground">
            Your feedback for {ctx.candidate_name} has been submitted to the hiring team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto bg-card border rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Interview Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Candidate: <span className="font-medium text-foreground">{ctx.candidate_name}</span> · Position:{" "}
            <span className="font-medium text-foreground">{ctx.job_title}</span>
            {ctx.hiring_manager && (
              <>
                {" "}
                · Hiring Manager: <span className="font-medium text-foreground">{ctx.hiring_manager}</span>
              </>
            )}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-by">Feedback done by *</Label>
            <Input
              id="feedback-by"
              value={feedbackBy}
              onChange={(e) => setFeedbackBy(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          {areas.map((area) => <div key={area.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><Label>{area.label} *</Label>{area.description && <p className="text-xs text-muted-foreground">{area.description}</p>}</div><StarRating value={ratings[area.id] ?? 0} onChange={(value) => setRatings((current) => ({ ...current, [area.id]: value }))} size={26} /></div>)}
          <div className="space-y-1.5"><Label htmlFor="feedback-summary">Written summary *</Label><Textarea id="feedback-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} required /></div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit Feedback"}
          </Button>
        </form>
      </div>
    </div>
  );
}
