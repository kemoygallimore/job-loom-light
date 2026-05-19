import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { DEFAULT_DATA_PROTECTION_HTML } from "@/lib/defaultDataProtection";

export default function CompanyPolicyTab({ companyId }: { companyId: string }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("company_policies")
      .select("data_protection_html, updated_at")
      .eq("company_id", companyId)
      .maybeSingle();
    setHtml(data?.data_protection_html ?? DEFAULT_DATA_PROTECTION_HTML);
    setUpdatedAt(data?.updated_at ?? null);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("company_policies")
      .upsert(
        { company_id: companyId, data_protection_html: html, updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: "company_id" },
      );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy saved");
    refresh();
  };

  const resetToDefault = () => {
    if (!confirm("Reset to the default template?")) return;
    setHtml(DEFAULT_DATA_PROTECTION_HTML);
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Data Protection Agreement</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Shown to candidates on public application pages and to this company's users via Account → Data Protection.
              {updatedAt && <> Last saved {new Date(updatedAt).toLocaleString()}.</>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetToDefault}>Reset to default</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Content</Label>
          <RichTextEditor value={html} onChange={setHtml} />
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save policy"}
        </Button>
      </div>
    </div>
  );
}