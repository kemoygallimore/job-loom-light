import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getAdminCompanyDetail,
  insertAddon,
  removeAddon,
  setAddonActive,
  updateCompany,
  upsertFeatures,
  upsertSubscription,
} from "@/features/admin-company-detail/api";
import { AddonsTab } from "@/features/admin-company-detail/components/AddonsTab";
import { BillingTab, EmailDomainTab, UsersTab } from "@/features/admin-company-detail/components/CompanyBillingTabs";
import { CompanyHeader } from "@/features/admin-company-detail/components/CompanyHeader";
import { EditCompanyDialog } from "@/features/admin-company-detail/components/EditCompanyDialog";
import { FeaturesTab } from "@/features/admin-company-detail/components/FeaturesTab";
import { SubscriptionTab } from "@/features/admin-company-detail/components/SubscriptionTab";
import {
  toCents,
  type Addon,
  type CompanySummary,
  type Features,
  type PlanDefaults,
  type Subscription,
} from "@/features/admin-company-detail/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { buildTenantAlerts, buildTenantSnapshots, type AdminActionRow, type AdminApplicationRow, type AdminBillingProfileRow, type AdminCandidateRow, type AdminEmailLogRow, type AdminInvoiceRow, type AdminJobRow, type AdminScreeningJobRow, type AdminScreeningSubmissionRow } from "@/lib/adminConsole";
import { useAuth } from "@/hooks/useAuth";

type QueryError = { message: string } | null;
type UntypedQuery = PromiseLike<{ data: unknown; error: QueryError }> & {
  eq: (column: string, value: unknown) => UntypedQuery;
  insert: (payload: unknown) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery;
  select: (columns?: string) => UntypedQuery;
};
type UntypedSupabase = {
  from: (table: string) => UntypedQuery;
};
type InvoiceEventRow = {
  invoice_id: string;
  event: string;
  at: string;
  meta: unknown;
};

const adminDb = supabase as unknown as UntypedSupabase;

function messageFromError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function defaultAddonPrice(defaults: PlanDefaults | null, addonType: string) {
  if (!defaults) return 0;
  switch (addonType) {
    case "extra_jobs_pack5": return defaults.addon_price_extra_jobs_pack5_cents;
    case "extra_seats_pack2": return defaults.addon_price_extra_seats_pack2_cents;
    case "email_notifications": return defaults.addon_price_email_notifications_cents;
    case "custom_email_domain": return defaults.addon_price_custom_email_domain_cents;
    default: return 0;
  }
}

export default function AdminCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanySummary | null>(null);
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
  const [jobLimit, setJobLimit] = useState<number | null>(null);
  const [seatLimit, setSeatLimit] = useState<number | null>(null);
  const [newType, setNewType] = useState<string>("extra_jobs_pack5");
  const [newQty, setNewQty] = useState<string>("1");
  const [newPrice, setNewPrice] = useState<string>("");
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [candidates, setCandidates] = useState<AdminCandidateRow[]>([]);
  const [applications, setApplications] = useState<AdminApplicationRow[]>([]);
  const [screeningJobs, setScreeningJobs] = useState<AdminScreeningJobRow[]>([]);
  const [screeningSubmissions, setScreeningSubmissions] = useState<AdminScreeningSubmissionRow[]>([]);
  const [emailLogs, setEmailLogs] = useState<AdminEmailLogRow[]>([]);
  const [invoices, setInvoices] = useState<AdminInvoiceRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminActionRow[]>([]);
  const [billingProfile, setBillingProfile] = useState<AdminBillingProfileRow | null>(null);

  const logAction = async (action: string, summary: string, meta: Record<string, unknown> = {}, entityType = "company", entityId: string | null = null) => {
    if (!id) return;
    await adminDb.from("super_admin_action_log").insert({
      company_id: id,
      actor_user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      meta,
    });
  };

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [data, jobsRes, candidatesRes, applicationsRes, screeningJobsRes, screeningSubsRes, emailLogsRes, invoicesRes, billingProfileRes, auditLogsRes, invoiceEventsRes] = await Promise.all([
      getAdminCompanyDetail(id),
      supabase.from("jobs").select("company_id, status, created_at, expires_at, id, title, hiring_manager").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("candidates").select("company_id, created_at, resume_size_bytes, id, name, email, phone, linkedin_url, country, parish_state, street_address").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("applications").select("company_id, stage, created_at, updated_at, job_id, candidate_id, id").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("screening_jobs").select("company_id, created_at, expires_at, id, title, question").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("screening_submissions").select("company_id, created_at, status, upload_status, video_size_bytes, id, candidate_name, candidate_email").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("email_send_log").select("company_id, created_at, status, error_message, template_key, recipient_email").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("invoices").select("company_id, status, due_at, issued_at, paid_at, total_cents, created_at, invoice_number, currency, id").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("company_billing_profiles").select("company_id, legal_name, billing_email, billing_address").eq("company_id", id).maybeSingle(),
      adminDb.from("super_admin_action_log").select("*").eq("company_id", id).order("created_at", { ascending: false }).limit(50),
      adminDb.from("invoice_events").select("invoice_id, event, at, meta").order("at", { ascending: false }).limit(50),
    ]);
    setCompany(data.company);
    setDefaults(data.defaults);
    setSub(data.subscription);
    setAddons(data.addons);
    setFeatures(data.features);
    setJobLimit(data.jobLimit);
    setSeatLimit(data.seatLimit);
    setJobs((jobsRes.data ?? []) as AdminJobRow[]);
    setCandidates((candidatesRes.data ?? []) as AdminCandidateRow[]);
    setApplications((applicationsRes.data ?? []) as AdminApplicationRow[]);
    setScreeningJobs((screeningJobsRes.data ?? []) as AdminScreeningJobRow[]);
    setScreeningSubmissions((screeningSubsRes.data ?? []) as AdminScreeningSubmissionRow[]);
    setEmailLogs((emailLogsRes.data ?? []) as AdminEmailLogRow[]);
    setInvoices((invoicesRes.data ?? []) as AdminInvoiceRow[]);
    setBillingProfile((billingProfileRes.data ?? null) as AdminBillingProfileRow | null);
    setAuditLogs([
      ...((auditLogsRes.data ?? []) as AdminActionRow[]),
      ...(((invoiceEventsRes.data ?? []) as InvoiceEventRow[]).map((row) => ({
        id: `${row.invoice_id}-${row.event}-${row.at}`,
        company_id: id,
        actor_user_id: null,
        action: row.event,
        entity_type: "invoice",
        entity_id: row.invoice_id,
        summary: row.event.replaceAll("_", " "),
        meta: row.meta ?? {},
        created_at: row.at,
      })) as AdminActionRow[]),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const companySnapshot = useMemo(() => {
    if (!company) return null;
    const createdAt = jobs[0]?.created_at ?? candidates[0]?.created_at ?? applications[0]?.created_at ?? new Date().toISOString();
    return buildTenantSnapshots({
      companies: [{ id: id ?? "company", name: company.name, slug: "", status: company.status, max_open_jobs: jobLimit ?? 0, created_at: createdAt }],
      profiles: [],
      jobs,
      candidates,
      applications,
      screeningJobs,
      screeningSubmissions,
      emailLogs,
      invoices,
      billingProfiles: billingProfile ? [billingProfile] : [],
      subscriptions: sub ? [{
        company_id: id ?? "",
        override_open_jobs: sub.override_open_jobs,
        override_seats: sub.override_seats,
        discount_type: sub.discount_type,
        discount_value: sub.discount_value,
        renewal_date: sub.renewal_date,
        auto_renew: sub.auto_renew,
      }] : [],
      planDefaults: defaults ? {
        included_open_jobs: defaults.included_open_jobs,
        included_seats: defaults.included_seats,
      } : null,
    })[0] ?? null;
  }, [applications, billingProfile, candidates, company, defaults, emailLogs, id, invoices, jobs, jobLimit, screeningJobs, screeningSubmissions, sub]);

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
    try {
      await updateCompany(id, editName.trim(), editStatus);
      await logAction("update_company", `Updated company to ${editName.trim()}`, { previous: company?.name, next: editName.trim(), status: editStatus });
      toast.success("Company updated");
      setEditOpen(false);
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not update company"));
    } finally {
      setEditBusy(false);
    }
  };

  const saveSubscription = async () => {
    if (!sub || !id) return;
    setSaving(true);
    try {
      await upsertSubscription(id, sub);
      await logAction("update_subscription", "Updated tenant subscription", { subscription: sub });
      toast.success("Subscription saved");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not save subscription"));
    } finally {
      setSaving(false);
    }
  };

  const saveFeatures = async () => {
    if (!features || !id) return;
    setSavingFeatures(true);
    try {
      await upsertFeatures(id, features);
      await logAction("update_features", "Updated tenant feature switches", { features });
      toast.success("Features updated");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not save features"));
    } finally {
      setSavingFeatures(false);
    }
  };

  const addAddon = async () => {
    if (!id) return;
    const qty = parseInt(newQty, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    const unit = toCents(newPrice) ?? defaultAddonPrice(defaults, newType);
    try {
      await insertAddon(id, newType, qty, unit);
      await logAction("add_addon", `Added add-on ${newType}`, { addon_type: newType, quantity: qty, unit_price_cents: unit });
      toast.success("Add-on added");
      setNewQty("1");
      setNewPrice("");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not add add-on"));
    }
  };

  const toggleAddon = async (addon: Addon) => {
    try {
      await setAddonActive(addon.id, !addon.active);
      await logAction(
        addon.active ? "disable_addon" : "enable_addon",
        `${addon.active ? "Disabled" : "Enabled"} add-on ${addon.addon_type}`,
        { addon_id: addon.id, active: !addon.active },
        "addon",
        addon.id,
      );
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not update add-on"));
    }
  };

  const deleteAddon = async (addon: Addon) => {
    if (!confirm("Remove this add-on?")) return;
    try {
      await removeAddon(addon.id);
      await logAction("remove_addon", `Removed add-on ${addon.addon_type}`, { addon_id: addon.id }, "addon", addon.id);
      toast.success("Add-on removed");
      refresh();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not remove add-on"));
    }
  };

  if (loading || !sub) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  }

  const currency = defaults?.currency ?? "USD";
  const openJobs = jobs.filter((job) => job.status === "open");
  const currentSnapshot = companySnapshot;
  const tenantAlerts = currentSnapshot ? buildTenantAlerts([currentSnapshot]) : [];
  const billingOverdue = invoices.filter((invoice) => {
    const due = invoice.due_at ? new Date(invoice.due_at).getTime() : null;
    const paid = invoice.paid_at ? new Date(invoice.paid_at).getTime() : null;
    return invoice.status !== "paid" && invoice.status !== "void" && due != null && due < Date.now() && paid == null;
  });

  return (
    <div className="space-y-6">
      <CompanyHeader company={company} jobLimit={jobLimit} seatLimit={seatLimit} onEdit={openEdit} />

      <Tabs defaultValue="overview" className="animate-fade-in" style={{ animationDelay: "80ms" }}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="email-domain">Email Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {currentSnapshot && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={company?.status === "active" ? "secondary" : company?.status === "archived" ? "outline" : "destructive"} className={company?.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : undefined}>
                      {company?.status ?? "active"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Users</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{currentSnapshot.users}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Open jobs</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{currentSnapshot.openJobs} / {currentSnapshot.jobLimit}</CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Last activity</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{currentSnapshot.lastActivityAt ? new Date(currentSnapshot.lastActivityAt).toLocaleString() : "No activity"}</CardContent></Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader><CardTitle>Hiring</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Jobs</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.jobs}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Candidates</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.candidates}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Applications</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.applications}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Screenings</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.screeningSubmissions}</div></div></CardContent></Card>
                <Card><CardHeader><CardTitle>Billing</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Invoices</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.invoices}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Overdue</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.overdueInvoices}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Renewal</div><div className="mt-1 text-sm font-medium">{currentSnapshot.renewsOn ?? "—"}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Auto-renew</div><div className="mt-1 text-sm font-medium">{currentSnapshot.autoRenew ? "On" : "Off"}</div></div></CardContent></Card>
                <Card><CardHeader><CardTitle>Usage</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Storage</div><div className="mt-1 text-xl font-semibold">{(currentSnapshot.storageBytes / 1024 / 1024 / 1024).toFixed(1)} GB</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Emails</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.emailEvents}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Open headroom</div><div className="mt-1 text-sm font-medium">{currentSnapshot.openJobHeadroom}</div></div><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Seat headroom</div><div className="mt-1 text-sm font-medium">{currentSnapshot.seatHeadroom}</div></div></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>Tenant health</CardTitle>
                    <p className="text-sm text-muted-foreground">The most important support flags for this tenant.</p>
                  </div>
                  <Badge variant={currentSnapshot.billingReady ? "secondary" : "destructive"}>{currentSnapshot.billingReady ? "Billing ready" : "Billing incomplete"}</Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {tenantAlerts.slice(0, 6).map((alert) => (
                    <Badge key={alert.id} variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "secondary" : "outline"} className={alert.severity === "low" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : undefined}>
                      {alert.message}
                    </Badge>
                  ))}
                  {tenantAlerts.length === 0 && <span className="text-sm text-muted-foreground">No active issues for this tenant.</span>}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6 mt-6">
          {id && <UsersTab companyId={id} seatLimit={seatLimit} />}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Jobs</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hiring manager</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell><Badge variant={job.status === "open" ? "secondary" : "outline"}>{job.status}</Badge></TableCell>
                      <TableCell>{job.hiring_manager ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(job.expires_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {jobs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No jobs found for this tenant.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Candidates</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.name}</TableCell>
                      <TableCell>{candidate.email ?? "—"}</TableCell>
                      <TableCell>{candidate.phone ?? "—"}</TableCell>
                      <TableCell className="max-w-56 truncate">{candidate.linkedin_url ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(candidate.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {candidates.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No candidates found for this tenant.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Invoices</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{invoices.length}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Overdue</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular-nums">{billingOverdue.length}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Renewal</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{currentSnapshot?.renewsOn ?? "—"}</CardContent></Card>
          </div>
          {id && (
            <BillingTab
              addons={addons}
              billingProfile={billingProfile}
              companyId={id}
              defaults={defaults}
              invoices={invoices}
              jobLimit={jobLimit}
              seatLimit={seatLimit}
              subscription={sub}
            />
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-6 mt-6">
          {currentSnapshot && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Open job usage</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{currentSnapshot.openJobUsagePct.toFixed(0)}%</div><p className="text-xs text-muted-foreground">{currentSnapshot.openJobs} of {currentSnapshot.jobLimit} used</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Seat usage</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{currentSnapshot.seatUsagePct.toFixed(0)}%</div><p className="text-xs text-muted-foreground">{currentSnapshot.users} of {currentSnapshot.seatLimit} used</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Resume storage</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{(currentSnapshot.resumeBytes / 1024 / 1024).toFixed(1)} MB</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Video storage</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{(currentSnapshot.videoBytes / 1024 / 1024).toFixed(1)} MB</div></CardContent></Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Usage summary</CardTitle>
                  <p className="text-sm text-muted-foreground">Recent signals that drive tenant support and capacity planning.</p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Applications</div><div className="mt-1 text-xl font-semibold">{applications.length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Screenings</div><div className="mt-1 text-xl font-semibold">{screeningSubmissions.length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Email events</div><div className="mt-1 text-xl font-semibold">{emailLogs.length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Jobs</div><div className="mt-1 text-xl font-semibold">{openJobs.length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Current alerts</div><div className="mt-1 text-xl font-semibold">{tenantAlerts.length}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Billing readiness</div><div className="mt-1 text-xl font-semibold">{currentSnapshot.billingReady ? "Ready" : "Needs work"}</div></div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
              <p className="text-sm text-muted-foreground">Super-admin actions and billing events for this tenant.</p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{entry.action}</Badge></TableCell>
                      <TableCell className="font-medium">{entry.summary}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.entity_type}{entry.entity_id ? ` · ${entry.entity_id}` : ""}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.actor_user_id ?? "system"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {auditLogs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No audit entries yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6 mt-6">
          <SubscriptionTab
            currency={currency}
            defaults={defaults}
            saving={saving}
            subscription={sub}
            onSave={saveSubscription}
            onSubscriptionChange={setSub}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-6 mt-6">
          <FeaturesTab
            features={features}
            saving={savingFeatures}
            onFeaturesChange={setFeatures}
            onSave={saveFeatures}
          />
        </TabsContent>

        <TabsContent value="addons" className="space-y-6 mt-6">
          <AddonsTab
            addons={addons}
            currency={currency}
            newPrice={newPrice}
            newQty={newQty}
            newType={newType}
            onAddAddon={addAddon}
            onDeleteAddon={deleteAddon}
            onNewPriceChange={setNewPrice}
            onNewQtyChange={setNewQty}
            onNewTypeChange={setNewType}
            onToggleAddon={toggleAddon}
          />
        </TabsContent>

        <TabsContent value="email-domain" className="space-y-6 mt-6">
          {id && <EmailDomainTab companyId={id} />}
        </TabsContent>
      </Tabs>

      <EditCompanyDialog
        busy={editBusy}
        name={editName}
        open={editOpen}
        status={editStatus}
        onNameChange={setEditName}
        onOpenChange={setEditOpen}
        onSave={saveCompany}
        onStatusChange={setEditStatus}
      />
    </div>
  );
}
