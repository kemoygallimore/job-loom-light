import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Plus, Settings2, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import StarRating from "@/components/feedback/StarRating";
import InterviewScorecardSettings from "@/components/feedback/InterviewScorecardSettings";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface JobOption { id: string; title: string; hiring_manager?: string | null }
interface Props { candidateId: string; companyId: string; userId: string; jobs: JobOption[]; defaultJobId?: string; currentUserName?: string }
interface Area { id: string; label: string; description: string | null }
interface Entry { id: string; feedback_by: string | null; submitted_by: string | null; submitted_at: string; summary: string | null; panelist_average: number | null; ratings: Record<string, number>; scorecard_snapshot: { areas?: Area[] } | null }

export default function InterviewFeedback({ candidateId, companyId, userId, jobs, defaultJobId, currentUserName }: Props) {
  const [versionId, setVersionId] = useState<string | null>(null); const [areas, setAreas] = useState<Area[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({}); const [summary, setSummary] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]); const [saving, setSaving] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false);
  const activeJob = jobs.find((job) => job.id === defaultJobId) ?? jobs[0];

  const load = useCallback(async () => {
    const [{ data: version }, { data: feedback }] = await Promise.all([
      supabase.from("interview_scorecard_versions").select("id").eq("company_id", companyId).eq("status", "published").order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("interview_feedback").select("id, feedback_by, submitted_by, submitted_at, summary, panelist_average, ratings, scorecard_snapshot").eq("candidate_id", candidateId).eq("job_id", activeJob?.id ?? "").order("submitted_at", { ascending: false }),
    ]);
    if (version) { const { data } = await supabase.from("interview_scorecard_areas").select("id, label, description").eq("version_id", version.id).order("position"); setVersionId(version.id); setAreas(data ?? []); }
    else { setVersionId(null); setAreas([]); }
    setEntries((feedback ?? []).map((entry) => ({ ...entry, ratings: (entry.ratings as Record<string, number> | null) ?? {}, scorecard_snapshot: entry.scorecard_snapshot as Entry["scorecard_snapshot"] })));
  }, [activeJob?.id, candidateId, companyId]);
  useEffect(() => { load(); }, [load]);

  const overall = useMemo(() => entries.length ? entries.reduce((sum, entry) => sum + (entry.panelist_average ?? 0), 0) / entries.length : null, [entries]);
  const submit = async () => {
    if (!activeJob || !versionId || areas.length < 2) { toast.error("Publish a company scorecard before adding feedback"); return; }
    if (areas.some((area) => !ratings[area.id]) || !summary.trim()) { toast.error("Rate every area and add a written summary"); return; }
    setSaving(true); const average = Number((areas.reduce((sum, area) => sum + ratings[area.id], 0) / areas.length).toFixed(2));
    const snapshot = { areas, scale: ["Poor", "Below expectations", "Meets expectations", "Exceeds expectations", "Exceptional"] };
    const { error } = await supabase.from("interview_feedback").insert({ candidate_id: candidateId, company_id: companyId, job_id: activeJob.id, submitted_by: userId, feedback_by: currentUserName ?? null, feedback_text: summary.trim(), summary: summary.trim(), scorecard_version_id: versionId, scorecard_snapshot: snapshot as unknown as Json, ratings, panelist_average: average, rating: Math.round(average), source: "internal" });
    setSaving(false); if (error) { toast.error(error.message); return; } setRatings({}); setSummary(""); toast.success("Interview feedback submitted"); await load();
  };
  const remove = async (id: string) => { if (!window.confirm("Permanently delete this feedback? The interview average will recalculate.")) return; const { error } = await supabase.from("interview_feedback").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Feedback deleted"); await load(); } };

  return <div className="rounded-xl border bg-card p-6 space-y-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Interview feedback</h2><p className="text-sm text-muted-foreground">{activeJob?.title ?? "Select an application"}{overall != null ? ` · Overall ${overall.toFixed(1)}/5` : " · No ratings yet"}</p></div><Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 className="mr-2 size-4" />Scorecard</Button></DialogTrigger><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Company interview scorecard</DialogTitle></DialogHeader><InterviewScorecardSettings companyId={companyId} userId={userId} onPublished={() => { setSettingsOpen(false); load(); }} /></DialogContent></Dialog></div>
    {areas.length >= 2 ? <div className="rounded-lg border bg-muted/20 p-4 space-y-4"><div><p className="text-sm font-medium">Your independent evaluation</p><p className="text-xs text-muted-foreground">Other panelists’ ratings are listed only after submission.</p></div>{areas.map((area) => <div key={area.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{area.label}</p>{area.description && <p className="text-xs text-muted-foreground">{area.description}</p>}</div><StarRating value={ratings[area.id] ?? 0} onChange={(value) => setRatings((current) => ({ ...current, [area.id]: value }))} /></div>)}<div className="space-y-2"><label className="text-sm font-medium">Written summary *</label><Textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summarize your assessment and recommendation" /></div><div className="flex justify-end"><Button disabled={saving || areas.some((area) => !ratings[area.id]) || !summary.trim()} onClick={submit}><Plus className="mr-2 size-4" />Submit feedback</Button></div></div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Create a company scorecard with 2–10 rating areas to begin.</div>}
    <div className="space-y-3">{entries.map((entry) => { const snapshotAreas = entry.scorecard_snapshot?.areas ?? []; return <article key={entry.id} className="rounded-lg border p-4 space-y-3"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /><span className="text-sm font-medium">{entry.feedback_by || "Guest panelist"}</span>{!entry.submitted_by && <Badge variant="secondary">Guest—unverified</Badge>}</div><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{new Date(entry.submitted_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className="text-lg font-semibold tabular-nums">{entry.panelist_average?.toFixed(1) ?? "—"}/5</span><Button variant="ghost" size="icon" onClick={() => remove(entry.id)}><Trash2 className="size-4 text-destructive" /></Button></div></div><div className="grid gap-2 sm:grid-cols-2">{snapshotAreas.map((area) => <div key={area.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{area.label}</span><span className="font-medium tabular-nums">{entry.ratings[area.id] ?? "—"}/5</span></div>)}</div><p className="whitespace-pre-wrap text-sm">{entry.summary}</p></article>; })}{entries.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No panel feedback submitted for this job.</p>}</div>
  </div>;
}
