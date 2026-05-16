import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  BillingProfile,
  fetchBillingProfile,
  upsertBillingProfile,
  missingBillingFields,
} from "@/lib/billingProfile";

interface Props {
  companyId: string;
  /** When false, fields render as read-only (tenant non-admin view). */
  canEdit?: boolean;
}

const EMPTY = (companyId: string): BillingProfile => ({
  company_id: companyId,
  legal_name: "",
  billing_email: "",
  billing_contact_name: "",
  billing_phone: "",
  billing_address: "",
  trn: "",
  customer_code: null,
});

export default function BillingProfileForm({ companyId, canEdit = true }: Props) {
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBillingProfile(companyId)
      .then((p) => {
        if (cancelled) return;
        setProfile(p ?? EMPTY(companyId));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await upsertBillingProfile({
        company_id: companyId,
        legal_name: profile.legal_name?.trim() || null,
        billing_email: profile.billing_email?.trim() ?? "",
        billing_contact_name: profile.billing_contact_name?.trim() || null,
        billing_phone: profile.billing_phone?.trim() || null,
        billing_address: profile.billing_address?.trim() || null,
        trn: profile.trn?.trim() || null,
      });
      toast.success("Billing profile saved");
      const refreshed = await fetchBillingProfile(companyId);
      setProfile(refreshed ?? EMPTY(companyId));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div className="text-sm text-muted-foreground">Loading billing profile…</div>;
  }

  const missing = missingBillingFields(profile);
  const set = (k: keyof BillingProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setProfile({ ...profile, [k]: e.target.value });

  const ro = !canEdit;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Billing profile</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Used as the bill-to identity on every invoice. Changes only apply to invoices issued after saving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile.customer_code && (
            <Badge variant="outline" className="font-mono text-xs">{profile.customer_code}</Badge>
          )}
          {missing.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Incomplete
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Legal name *">
          <Input value={profile.legal_name ?? ""} onChange={set("legal_name")} readOnly={ro} />
        </Field>
        <Field label="Billing email *">
          <Input type="email" value={profile.billing_email ?? ""} onChange={set("billing_email")} readOnly={ro} />
        </Field>
        <Field label="Contact name">
          <Input value={profile.billing_contact_name ?? ""} onChange={set("billing_contact_name")} readOnly={ro} />
        </Field>
        <Field label="Phone">
          <Input value={profile.billing_phone ?? ""} onChange={set("billing_phone")} readOnly={ro} />
        </Field>
        <Field label="TRN / Tax ID">
          <Input value={profile.trn ?? ""} onChange={set("trn")} readOnly={ro} />
        </Field>
        <Field label="Customer code">
          <Input value={profile.customer_code ?? "(auto)"} readOnly />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Billing address *">
            <Textarea
              rows={3}
              value={profile.billing_address ?? ""}
              onChange={set("billing_address")}
              readOnly={ro}
            />
          </Field>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="text-xs text-destructive">
          Required before generating invoices: {missing.join(", ")}.
        </p>
      )}

      {canEdit && (
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save billing profile"}
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}