import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AreaDraft { id: string; label: string; description: string }
interface Props { companyId: string; userId: string; onPublished?: () => void }

export default function InterviewScorecardSettings({ companyId, userId, onPublished }: Props) {
  const [versionId, setVersionId] = useState<string | null>(null); const [version, setVersion] = useState(1);
  const [status, setStatus] = useState("draft"); const [areas, setAreas] = useState<AreaDraft[]>([]); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const { data: versionRow } = await supabase.from("interview_scorecard_versions").select("*").eq("company_id", companyId).in("status", ["draft", "published"]).order("version", { ascending: false }).limit(1).maybeSingle();
    if (!versionRow) { setVersionId(null); setAreas([]); setStatus("draft"); return; }
    const { data: areaRows } = await supabase.from("interview_scorecard_areas").select("*").eq("version_id", versionRow.id).order("position");
    setVersionId(versionRow.id); setVersion(versionRow.version); setStatus(versionRow.status); setAreas((areaRows ?? []).map((area) => ({ id: area.id, label: area.label, description: area.description ?? "" })));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  const publish = async () => {
    if (areas.length < 2 || areas.length > 10 || areas.some((area) => !area.label.trim())) { toast.error("Add 2–10 named rating areas"); return; }
    setSaving(true); let targetId = versionId;
    if (status === "published") {
      await supabase.from("interview_scorecard_versions").update({ status: "archived" }).eq("id", versionId!);
      const { data, error } = await supabase.from("interview_scorecard_versions").insert({ company_id: companyId, version: version + 1, created_by: userId }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; } targetId = data.id;
    } else if (!targetId) {
      const { data, error } = await supabase.from("interview_scorecard_versions").insert({ company_id: companyId, version, created_by: userId }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; } targetId = data.id;
    }
    await supabase.from("interview_scorecard_areas").delete().eq("version_id", targetId!);
    const { error } = await supabase.from("interview_scorecard_areas").insert(areas.map((area, position) => ({ id: area.id, version_id: targetId!, position, label: area.label.trim(), description: area.description.trim() || null })));
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("interview_scorecard_versions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", targetId!);
    toast.success("Company interview scorecard published"); setSaving(false); await load(); onPublished?.();
  };
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">One company-wide scorecard is used for every job. Publishing changes creates a historical version.</p>{areas.map((area, index) => <div key={area.id} className="grid gap-2 rounded-lg border p-3"><div className="flex gap-2"><span className="mt-2 text-xs font-medium text-muted-foreground">{index + 1}</span><Input value={area.label} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, label: event.target.value } : item))} placeholder="Rating area, e.g. Communication" /><Button variant="ghost" size="icon" disabled={areas.length <= 2} onClick={() => setAreas((current) => current.filter((item) => item.id !== area.id))}><Trash2 className="size-4" /></Button></div><Textarea rows={2} value={area.description} onChange={(event) => setAreas((current) => current.map((item) => item.id === area.id ? { ...item, description: event.target.value } : item))} placeholder="Optional guidance for panelists" /></div>)}<div className="flex justify-between"><Button variant="outline" disabled={areas.length >= 10} onClick={() => setAreas((current) => [...current, { id: crypto.randomUUID(), label: "", description: "" }])}><Plus className="mr-2 size-4" />Add area</Button><Button disabled={saving || areas.length < 2} onClick={publish}>Publish scorecard</Button></div></div>;
}
