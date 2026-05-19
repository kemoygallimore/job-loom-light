import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import BillingProfileForm from "@/components/billing/BillingProfileForm";
import BillingCycleCard from "@/components/billing/BillingCycleCard";
import CompanyInvoicesCard from "@/components/billing/CompanyInvoicesCard";
import CompanyEmailDomainTab from "@/components/admin/CompanyEmailDomainTab";
import CompanyUsersTab from "@/components/admin/CompanyUsersTab";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

interface Subscription {
  id?: string;
  company_id: string;
  override_annual_price_cents: number | null;
  override_open_jobs: number | null;
  override_seats: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_note: string | null;
}

interface Addon {
  id: string;
  company_id: string;
  addon_type: string;
  quantity: number;
  unit_price_cents: number;
  active: boolean;
  note: string | null;
}

interface PlanDefaults {
  annual_price_cents: number;
  included_open_jobs: number;
  included_seats: number;
  currency: string;
  addon_price_extra_jobs_pack5_cents: number;
  addon_price_extra_seats_pack2_cents: number;
  addon_price_email_notifications_cents: number;
  addon_price_custom_email_domain_cents: number;
}

interface Features {
  feature_assessment: boolean;
  feature_public_careers: boolean;
  feature_guest_feedback: boolean;
  feature_email_notifications: boolean;
  feature_custom_email_domain: boolean;
}

const FEATURE_LABELS: Array<{ key: keyof Features; label: string; comingSoon?: boolean }> = [
  { key: "feature_assessment", label: "Assessment Module" },
  { key: "feature_public_careers", label: "Public Careers Portal" },
  { key: "feature_guest_feedback", label: "Guest Feedback Links" },
  { key: "feature_email_notifications", label: "Candidate Email Notifications", comingSoon: true },
  { key: "feature_custom_email_domain", label: "Custom Email Domain", comingSoon: true },
];

const ADDON_LABELS: Record<string, string> = {
  extra_jobs_pack5: "Extra Open Jobs (pack of 5)",
  extra_seats_pack2: "Extra User Seats (pack of 2)",
  email_notifications: "Candidate Email Notifications",
  custom_email_domain: "Custom Email Domain",
};

const cents = (n: number | null | undefined) =>
  n == null ? "" : (n / 100).toFixed(2);
const toCents = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
};

export default function AdminCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<{ name: string; status: string } | null>(null);
  const [defaults, setDefaults] = useState<PlanDefaults | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [features, setFeatures] = useState<Features | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editBusy, setEditBusy] = useState(false);

  // computed limits via RPC
  const [jobLimit, setJobLimit] = useState<number | null>(null);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);

  // new addon form
  const [newType, setNewType] = useState<string>("extra_jobs_pack5");
  const [newQty, setNewQty] = useState<string>("1");
  const [newPrice, setNewPrice] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [companyRes, defaultsRes, subRes, addonsRes, featuresRes, jobLimitRes, seatLimitRes] = await Promise.all([
      supabase.from("companies").select("name, status").eq("id", id).maybeSingle(),
      supabase.from("plan_defaults" as any).select("*").maybeSingle(),
      supabase.from("company_subscriptions" as any).select("*").eq("company_id", id).maybeSingle(),
      supabase.from("company_addons" as any).select("*").eq("company_id", id).order("created_at"),
      supabase.from("company_features" as any).select("*").eq("company_id", id).maybeSingle(),
      supabase.rpc("get_company_job_limit" as any, { _company_id: id }),
      supabase.rpc("get_company_seat_limit" as any, { _company_id: id }),
    ]);
    setCompany(companyRes.data as any);
    setDefaults(defaultsRes.data as any);
    setSub(
      (subRes.data as any) ?? {
        company_id: id,
        override_annual_price_cents: null,
        override_open_jobs: null,
        override_seats: null,
        discount_type: null,
        discount_value: null,
        discount_note: null,
      }
    );
    setAddons((addonsRes.data as any) ?? []);
    setFeatures(
      (featuresRes.data as any) ?? {
        feature_assessment: false,
        feature_public_careers: true,
        feature_guest_feedback: true,
        feature_email_notifications: false,
        feature_custom_email_domain: false,
      }
    );
    setJobLimit(jobLimitRes.data as number);
    setSeatLimit(seatLimitRes.data as number);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = () => {
    setEditName(company?.name ?? "");
    setEditStatus(company?.status ?? "active");
    setEditOpen(true);
  };

  const saveCompany = async () => {
    if (!id || !editName.trim()) {
      toast.error("Name is required");
      return;
    }
    setEditBusy(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: editName.trim(), status: editStatus } as any)
      .eq("id", id);
    setEditBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Company updated");
    setEditOpen(false);
    refresh();
  };

  const saveSubscription = async () => {
    if (!sub || !id) return;
    setSaving(true);
    const payload = {
      company_id: id,
      override_annual_price_cents: sub.override_annual_price_cents,
      override_open_jobs: sub.override_open_jobs,
      override_seats: sub.override_seats,
      discount_type: sub.discount_type,
      discount_value: sub.discount_value,
      discount_note: sub.discount_note,
    };
    const { error } = await supabase
      .from("company_subscriptions" as any)
      .upsert(payload, { onConflict: "company_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Keep companies.max_open_jobs in sync for legacy reads
    if (sub.override_open_jobs != null) {
      await supabase
        .from("companies")
        .update({ max_open_jobs: sub.override_open_jobs } as any)
        .eq("id", id);
    }
    toast.success("Subscription saved");
    refresh();
  };

  const saveFeatures = async () => {
    if (!features || !id) return;
    setSavingFeatures(true);
    const { error } = await supabase
      .from("company_features" as any)
      .upsert({ company_id: id, ...features }, { onConflict: "company_id" });
    setSavingFeatures(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Features updated");
    refresh();
  };

  const addAddon = async () => {
    if (!id) return;
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    const defaultPrice = (() => {
      if (!defaults) return 0;
      switch (newType) {
        case "extra_jobs_pack5": return defaults.addon_price_extra_jobs_pack5_cents;
        case "extra_seats_pack2": return defaults.addon_price_extra_seats_pack2_cents;
        case "email_notifications": return defaults.addon_price_email_notifications_cents;
        case "custom_email_domain": return defaults.addon_price_custom_email_domain_cents;
        default: return 0;
      }
    })();
    const unit = toCents(newPrice) ?? defaultPrice;
    const { error } = await supabase.from("company_addons" as any).insert({
      company_id: id,
      addon_type: newType,
      quantity: qty,
      unit_price_cents: unit,
      active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Add-on added");
    setNewQty("1");
    setNewPrice("");
    refresh();
  };

  const toggleAddon = async (a: Addon) => {
    const { error } = await supabase
      .from("company_addons" as any)
      .update({ active: !a.active })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const deleteAddon = async (a: Addon) => {
    if (!confirm("Remove this add-on?")) return;
    const { error } = await supabase.from("company_addons" as any).delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Add-on removed");
    refresh();
  };

  if (loading || !sub) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  }

  const currency = defaults?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/companies"><ArrowLeft className="w-4 h-4 mr-1" /> Companies</Link>
        </Button>
      </div>

      <div className="flex items-baseline justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{company?.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={company?.status === "suspended" ? "destructive" : "secondary"}>
              {company?.status ?? "active"}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              Effective limits: <strong className="text-foreground">{jobLimit}</strong> open jobs · <strong className="text-foreground">{seatLimit}</strong> seats
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit company
        </Button>
      </div>

      <Tabs defaultValue="subscription" className="animate-fade-in" style={{ animationDelay: "80ms" }}>
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="email-domain">Email Domain</TabsTrigger>
        </TabsList>

        {/* SUBSCRIPTION TAB */}
        <TabsContent value="subscription" className="space-y-6 mt-6">
          <div className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold">Plan & overrides</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Leave override fields blank to inherit from master pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Annual price override ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={defaults ? `Default: ${cents(defaults.annual_price_cents)}` : ""}
                  value={cents(sub.override_annual_price_cents)}
                  onChange={(e) => setSub({ ...sub, override_annual_price_cents: toCents(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Open jobs override</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={defaults ? `Default: ${defaults.included_open_jobs}` : ""}
                  value={sub.override_open_jobs ?? ""}
                  onChange={(e) =>
                    setSub({ ...sub, override_open_jobs: e.target.value === "" ? null : parseInt(e.target.value, 10) })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">User seats override</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={defaults ? `Default: ${defaults.included_seats}` : ""}
                  value={sub.override_seats ?? ""}
                  onChange={(e) =>
                    setSub({ ...sub, override_seats: e.target.value === "" ? null : parseInt(e.target.value, 10) })
                  }
                />
              </div>
            </div>

            <div className="border-t pt-5 space-y-4">
              <h3 className="text-sm font-semibold">Discount</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select
                    value={sub.discount_type ?? "none"}
                    onValueChange={(v) =>
                      setSub({
                        ...sub,
                        discount_type: v === "none" ? null : v,
                        discount_value: v === "none" ? null : sub.discount_value,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No discount</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="fixed">Fixed amount ({currency})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!sub.discount_type}
                    value={sub.discount_value ?? ""}
                    onChange={(e) =>
                      setSub({ ...sub, discount_value: e.target.value === "" ? null : parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Internal note</Label>
                <Input
                  placeholder="e.g. Founders' partner deal"
                  value={sub.discount_note ?? ""}
                  onChange={(e) => setSub({ ...sub, discount_note: e.target.value || null })}
                />
              </div>
            </div>

            <Button onClick={saveSubscription} disabled={saving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save subscription"}
            </Button>
          </div>
        </TabsContent>

        {/* FEATURES TAB */}
        <TabsContent value="features" className="space-y-6 mt-6">
          <div className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl">
            <div>
              <h2 className="text-lg font-semibold">Non-core feature toggles</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enable or disable optional modules for this tenant.
              </p>
            </div>
            <div className="space-y-2">
              {features &&
                FEATURE_LABELS.map(({ key, label, comingSoon }) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{label}</Label>
                      {comingSoon && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          Coming soon
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={features[key]}
                      onCheckedChange={(b) => setFeatures({ ...features, [key]: b })}
                    />
                  </div>
                ))}
            </div>
            <Button onClick={saveFeatures} disabled={savingFeatures} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" /> {savingFeatures ? "Saving..." : "Save features"}
            </Button>
          </div>
        </TabsContent>

        {/* ADDONS TAB */}
        <TabsContent value="addons" className="space-y-6 mt-6">
          <div className="rounded-xl border bg-card p-6 space-y-4 max-w-3xl">
            <h2 className="text-lg font-semibold">Add a new add-on</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ADDON_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Qty</Label>
                <Input type="number" min="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Unit price ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Use default"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={addAddon}><Plus className="w-4 h-4 mr-2" /> Add add-on</Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden max-w-3xl">
            {addons.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No add-ons yet for this tenant.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="w-[1%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addons.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{ADDON_LABELS[a.addon_type] ?? a.addon_type}</TableCell>
                      <TableCell className="text-center tabular-nums">{a.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{cents(a.unit_price_cents)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {cents(a.unit_price_cents * a.quantity)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={a.active} onCheckedChange={() => toggleAddon(a)} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAddon(a)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* BILLING TAB */}
        <TabsContent value="billing" className="space-y-6 mt-6">
          <div className="rounded-xl border bg-card p-6 max-w-3xl">
            {id && <BillingProfileForm companyId={id} canEdit />}
          </div>
          <div className="rounded-xl border bg-card p-6 max-w-3xl">
            {id && <BillingCycleCard companyId={id} canEdit />}
          </div>
          <div className="rounded-xl border bg-card p-6">
            {id && <CompanyInvoicesCard companyId={id} />}
          </div>
        </TabsContent>

        {/* EMAIL DOMAIN TAB */}
        <TabsContent value="email-domain" className="space-y-6 mt-6">
          {id && <CompanyEmailDomainTab companyId={id} />}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-6 mt-6">
          {id && <CompanyUsersTab companyId={id} seatLimit={seatLimit} />}
        </TabsContent>

        {/* POLICIES TAB */}
        <TabsContent value="policies" className="space-y-6 mt-6">
          {id && <CompanyPolicyTab companyId={id} />}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit company</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Company name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Slug stays the same to keep existing public career page URLs working.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveCompany} disabled={editBusy}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> {editBusy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
