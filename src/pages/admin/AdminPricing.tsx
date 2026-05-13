import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DollarSign, Save } from "lucide-react";

interface PlanDefaults {
  id: boolean;
  currency: string;
  monthly_price_cents: number;
  included_open_jobs: number;
  included_seats: number;
  addon_price_extra_jobs_pack5_cents: number;
  addon_price_extra_seats_pack2_cents: number;
  addon_price_email_notifications_cents: number;
  addon_price_custom_email_domain_cents: number;
  default_feature_assessment: boolean;
  default_feature_public_careers: boolean;
  default_feature_guest_feedback: boolean;
  default_feature_email_notifications: boolean;
  default_feature_custom_email_domain: boolean;
}

const centsToStr = (c: number) => (c / 100).toFixed(2);
const strToCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

export default function AdminPricing() {
  const [data, setData] = useState<PlanDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).from("plan_defaults").select("*").maybeSingle();
      if (error) toast.error(error.message);
      setData(data as PlanDefaults);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-12 text-center text-muted-foreground">No pricing record found.</div>;

  const update = (patch: Partial<PlanDefaults>) => setData({ ...data, ...patch });

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("plan_defaults").update(data).eq("id", true);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Standard pricing updated");
  };

  const Money = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="number" step="0.01" min="0"
          value={centsToStr(value)}
          onChange={(e) => onChange(strToCents(e.target.value))}
          className="pl-8"
        />
      </div>
    </div>
  );

  const Num = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type="number" min="0" value={value} onChange={(e) => onChange(parseInt(e.target.value || "0", 10))} />
    </div>
  );

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standard Pricing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defaults applied to every tenant. Per-tenant overrides come later.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="active:scale-[0.97] transition-transform">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Base Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Currency</Label>
            <Input value={data.currency} onChange={(e) => update({ currency: e.target.value.toUpperCase().slice(0, 3) })} />
          </div>
          <Money label="Monthly price" value={data.monthly_price_cents} onChange={(n) => update({ monthly_price_cents: n })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Num label="Included open jobs" value={data.included_open_jobs} onChange={(n) => update({ included_open_jobs: n })} />
          <Num label="Included user seats" value={data.included_seats} onChange={(n) => update({ included_seats: n })} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add-ons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Money label="Extra open jobs (pack of 5)" value={data.addon_price_extra_jobs_pack5_cents} onChange={(n) => update({ addon_price_extra_jobs_pack5_cents: n })} />
          <Money label="Extra user seats (pack of 2)" value={data.addon_price_extra_seats_pack2_cents} onChange={(n) => update({ addon_price_extra_seats_pack2_cents: n })} />
          <Money label="Email notifications to candidates" value={data.addon_price_email_notifications_cents} onChange={(n) => update({ addon_price_email_notifications_cents: n })} />
          <Money label="Custom email domain" value={data.addon_price_custom_email_domain_cents} onChange={(n) => update({ addon_price_custom_email_domain_cents: n })} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Default Feature Switches</h2>
        <p className="text-xs text-muted-foreground">Applied to new tenants. Existing tenants keep their current settings.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Toggle label="Assessment Module" value={data.default_feature_assessment} onChange={(b) => update({ default_feature_assessment: b })} />
          <Toggle label="Public Careers Portal" value={data.default_feature_public_careers} onChange={(b) => update({ default_feature_public_careers: b })} />
          <Toggle label="Guest Feedback Links" value={data.default_feature_guest_feedback} onChange={(b) => update({ default_feature_guest_feedback: b })} />
          <Toggle label="Email Notifications" value={data.default_feature_email_notifications} onChange={(b) => update({ default_feature_email_notifications: b })} />
          <Toggle label="Custom Email Domain" value={data.default_feature_custom_email_domain} onChange={(b) => update({ default_feature_custom_email_domain: b })} />
        </div>
      </section>
    </div>
  );
}