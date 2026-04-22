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
  const [strengths, setStrengths] = useState("");
  const [opportunities, setOpportunities] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data: link, error: e } = await (supabase as any)
        .from("feedback_links")
        .select("id, company_id, candidate_id, job_id, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (e || !link) {
        setError("This feedback link is invalid or has expired.");
        setLoading(false);
        return;
      }
      const [{ data: c }, { data: j }] = await Promise.all([
        supabase.from("candidates").select("name").eq("id", link.candidate_id).maybeSingle(),
        supabase.from("jobs").select("title, hiring_manager").eq("id", link.job_id).maybeSingle(),
      ]);
      setCtx({
        ...link,
        candidate_name: c?.name ?? "Candidate",
        job_title: j?.title ?? "Position",
        hiring_manager: j?.hiring_manager ?? null,
      });
      setLoading(false);
    };
    load();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    if (!feedbackBy.trim() || !strengths.trim() || rating === 0) {
      toast.error("Please fill in your name, strengths, and a rating");
      return;
    }
    setSubmitting(true);
    const composedText = [
      strengths.trim() && `STRENGTHS:\n${strengths.trim()}`,
      opportunities.trim() && `OPPORTUNITIES:\n${opportunities.trim()}`,
      weaknesses.trim() && `WEAKNESSES:\n${weaknesses.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { error: insertErr } = await (supabase as any).from("interview_feedback").insert({
      candidate_id: ctx.candidate_id,
      job_id: ctx.job_id,
      company_id: ctx.company_id,
      feedback_text: composedText,
      feedback_by: feedbackBy.trim(),
      feedback_date: new Date().toISOString().slice(0, 10),
      hiring_manager: ctx.hiring_manager,
      strengths: strengths.trim() || null,
      opportunities: opportunities.trim() || null,
      weaknesses: weaknesses.trim() || null,
      rating,
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
            <Label>Feedback done by *</Label>
            <Input
              value={feedbackBy}
              onChange={(e) => setFeedbackBy(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Strengths *</Label>
            <Textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              placeholder="What did the candidate do well?"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Opportunities</Label>
            <Textarea
              value={opportunities}
              onChange={(e) => setOpportunities(e.target.value)}
              rows={3}
              placeholder="Areas where they could grow"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Weaknesses</Label>
            <Textarea
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              rows={3}
              placeholder="Concerns or weaknesses"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Overall rating *</Label>
            <StarRating value={rating} onChange={setRating} size={28} />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit Feedback"}
          </Button>
        </form>
      </div>
    </div>
  );
}
