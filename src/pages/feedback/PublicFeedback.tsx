import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PolicyConsentBlock } from "@/components/legal/PolicyConsentBlock";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import StarRating from "@/components/feedback/StarRating";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  GUEST_FEEDBACK_CONSENT_TEXT,
  buildConsentPayload,
  loadConsentPolicyContext,
  type ConsentPolicyContext,
} from "@/lib/consentPolicies";

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
  const [consent, setConsent] = useState(false);
  const [policyContext, setPolicyContext] = useState<ConsentPolicyContext | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data: link, error: e } = await supabase
        .from("feedback_links")
        .select("id, company_id, candidate_id, job_id, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (e || !link) {
        setError("This feedback link is invalid or has expired.");
        setLoading(false);
        return;
      }
      const { data: enabled } = await supabase.rpc("is_feature_enabled", {
        _company_id: link.company_id,
        _feature: "guest_feedback",
      });
      if (enabled === false) {
        setError("Guest feedback is no longer available for this company.");
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
      setPolicyContext(await loadConsentPolicyContext(link.company_id));
      const { data: version } = await supabase.from("interview_scorecard_versions").select("id").eq("company_id", link.company_id).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle();
      if (version) { const { data: areaRows } = await supabase.from("interview_scorecard_areas").select("id, label, description").eq("version_id", version.id).order("position"); setScorecardVersionId(version.id); setAreas(areaRows ?? []); }
      setLoading(false);
    };
    load();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx) return;
    if (!feedbackBy.trim() || !summary.trim() || areas.length < 2 || areas.some((area) => !ratings[area.id]) || !consent) {
      toast.error("Please enter your name, rate every area, add a summary, and accept consent");
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
      _consents: buildConsentPayload("guest_feedback", consent, GUEST_FEEDBACK_CONSENT_TEXT),
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

          {areas.map((area) => <div key={area.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><Label>{area.label} *</Label>{area.description && <p className="text-xs text-muted-foreground">{area.description}</p>}</div><StarRating value={ratings[area.id] ?? 0} onChange={(value) => setRatings((current) => ({ ...current, [area.id]: value }))} size={26} /></div>)}
          <div className="space-y-1.5"><Label>Written summary *</Label><Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} required /></div>
          <PolicyConsentBlock
            id="feedback-consent"
            context={policyContext}
            checked={consent}
            consentText={GUEST_FEEDBACK_CONSENT_TEXT}
            disabled={submitting}
            onCheckedChange={setConsent}
          />

          <Button type="submit" disabled={submitting || !consent} className="w-full">
            {submitting ? "Submitting…" : "Submit Feedback"}
          </Button>
        </form>
      </div>
    </div>
  );
}
