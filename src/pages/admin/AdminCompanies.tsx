import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Building2, Search, Users, Briefcase, Check, X, Pencil, Ban, Power, Settings, Download, AlertTriangle, Clock3, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  buildTenantAlerts,
  buildTenantSnapshots,
  downloadCsv,
  filterTenants,
  type AdminBillingProfileRow,
  type AdminCandidateRow,
  type AdminCompanyRow,
  type AdminEmailLogRow,
  type AdminInvoiceRow,
  type AdminJobRow,
  type AdminPlanDefaultsRow,
  type AdminProfileRow,
  type AdminScreeningJobRow,
  type AdminScreeningSubmissionRow,
  type AdminSubscriptionRow,
  type AdminApplicationRow,
} from "@/lib/adminConsole";

type QueryError = { message: string } | null;
type UntypedQuery = PromiseLike<{ data: unknown; error: QueryError }> & {
  eq: (column: string, value: unknown) => UntypedQuery;
  insert: (payload: unknown) => UntypedQuery;
  maybeSingle: () => UntypedQuery;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery;
  select: (columns?: string) => UntypedQuery;
  single: () => UntypedQuery;
  update: (payload: unknown) => UntypedQuery;
};
type UntypedSupabase = {
  from: (table: string) => UntypedQuery;
};
type CreatedCompany = {
  id: string;
  name: string;
};
type CreateAdminResponse = {
  error?: string;
};

const adminDb = supabase as unknown as UntypedSupabase;

type CompanyListData = {
  companies: AdminCompanyRow[];
  profiles: AdminProfileRow[];
  jobs: AdminJobRow[];
  candidates: AdminCandidateRow[];
  applications: AdminApplicationRow[];
  screeningJobs: AdminScreeningJobRow[];
  screeningSubmissions: AdminScreeningSubmissionRow[];
  emailLogs: AdminEmailLogRow[];
  invoices: AdminInvoiceRow[];
  billingProfiles: AdminBillingProfileRow[];
  subscriptions: AdminSubscriptionRow[];
  planDefaults: AdminPlanDefaultsRow | null;
};

const INITIAL_DATA: CompanyListData = {
  companies: [],
  profiles: [],
  jobs: [],
  candidates: [],
  applications: [],
  screeningJobs: [],
  screeningSubmissions: [],
  emailLogs: [],
  invoices: [],
  billingProfiles: [],
  subscriptions: [],
  planDefaults: null,
};

const STATUS_OPTIONS = ["all", "active", "suspended", "archived"] as const;
const PLAN_OPTIONS = ["all", "standard", "custom"] as const;

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>;
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="destructive">Suspended</Badge>;
}

export default function AdminCompanies() {
  const { user } = useAuth();
  const [data, setData] = useState<CompanyListData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [planFilter, setPlanFilter] = useState<(typeof PLAN_OPTIONS)[number]>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState<string>("");

  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const logAction = async (companyId: string, action: string, entityType: string, summary: string, meta: Record<string, unknown> = {}, entityId: string | null = null) => {
    await adminDb.from("super_admin_action_log").insert({
      company_id: companyId,
      actor_user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      meta,
    });
  };

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const [
      companiesRes,
      profilesRes,
      jobsRes,
      candidatesRes,
      applicationsRes,
      screeningJobsRes,
      screeningSubsRes,
      emailLogsRes,
      invoicesRes,
      billingProfilesRes,
      subscriptionsRes,
      planDefaultsRes,
    ] = await Promise.all([
      supabase.from("companies").select("id, name, slug, status, max_open_jobs, created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("company_id"),
      supabase.from("jobs").select("company_id, status, created_at, expires_at"),
      supabase.from("candidates").select("company_id, created_at, resume_size_bytes"),
      supabase.from("applications").select("company_id, stage, created_at, updated_at, job_id"),
      supabase.from("screening_jobs").select("company_id, created_at, expires_at"),
      supabase.from("screening_submissions").select("company_id, created_at, status, upload_status, video_size_bytes"),
      supabase.from("email_send_log").select("company_id, created_at, status, error_message"),
      supabase.from("invoices").select("company_id, status, due_at, issued_at, paid_at, total_cents, created_at"),
      supabase.from("company_billing_profiles").select("company_id, legal_name, billing_email, billing_address"),
      supabase.from("company_subscriptions").select("company_id, override_open_jobs, override_seats, discount_type, discount_value, renewal_date, auto_renew"),
      adminDb.from("plan_defaults").select("included_seats, included_open_jobs").maybeSingle(),
    ]);

    setData({
      companies: (companiesRes.data ?? []) as AdminCompanyRow[],
      profiles: (profilesRes.data ?? []) as AdminProfileRow[],
      jobs: (jobsRes.data ?? []) as AdminJobRow[],
      candidates: (candidatesRes.data ?? []) as AdminCandidateRow[],
      applications: (applicationsRes.data ?? []) as AdminApplicationRow[],
      screeningJobs: (screeningJobsRes.data ?? []) as AdminScreeningJobRow[],
      screeningSubmissions: (screeningSubsRes.data ?? []) as AdminScreeningSubmissionRow[],
      emailLogs: (emailLogsRes.data ?? []) as AdminEmailLogRow[],
      invoices: (invoicesRes.data ?? []) as AdminInvoiceRow[],
      billingProfiles: (billingProfilesRes.data ?? []) as AdminBillingProfileRow[],
      subscriptions: (subscriptionsRes.data ?? []) as AdminSubscriptionRow[],
      planDefaults: (planDefaultsRes.data ?? null) as AdminPlanDefaultsRow | null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const snapshots = useMemo(() => buildTenantSnapshots(data), [data]);
  const alerts = useMemo(() => buildTenantAlerts(snapshots), [snapshots]);
  const alertCountByTenant = useMemo(() => {
    const map = new Map<string, number>();
    alerts.forEach((alert) => map.set(alert.companyId, (map.get(alert.companyId) ?? 0) + 1));
    return map;
  }, [alerts]);

  const filtered = useMemo(() => filterTenants(snapshots, {
    search,
    status: statusFilter,
    plan: planFilter,
  }), [snapshots, search, statusFilter, planFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    setCreating(true);

    const { data: companyData, error: companyError } = await adminDb
      .from("companies")
      .insert({ name: companyName.trim(), status: "active" })
      .select()
      .single();
    const company = companyData as CreatedCompany | null;

    if (companyError || !company) {
      toast.error("Failed to create company: " + (companyError?.message ?? ""));
      setCreating(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.functions.invoke("create-company-admin", {
      body: {
        company_id: company.id,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword.trim(),
      },
    });

    const adminResponse = authData as CreateAdminResponse | null;
    if (authError || adminResponse?.error) {
      toast.error("Failed to create admin: " + (authError?.message ?? adminResponse?.error ?? ""));
      setCreating(false);
      return;
    }

    await logAction(company.id, "create_tenant", "company", `Created tenant ${company.name}`, { created_by: user?.id ?? null });
    toast.success(`Company "${company.name}" created successfully`);
    setCreating(false);
    setCreateOpen(false);
    setCompanyName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    fetchCompanies();
  };

  const startEditLimit = (companyId: string, currentLimit: number) => {
    setEditingLimitId(companyId);
    setEditingLimitValue(String(currentLimit));
  };

  const cancelEditLimit = () => {
    setEditingLimitId(null);
    setEditingLimitValue("");
  };

  const saveLimit = async (companyId: string) => {
    const n = parseInt(editingLimitValue, 10);
    if (isNaN(n) || n < 0 || n > 1000) {
      toast.error("Enter a number between 0 and 1000");
      return;
    }
    const current = snapshots.find((tenant) => tenant.id === companyId);
    const { error } = await adminDb.from("companies").update({ max_open_jobs: n }).eq("id", companyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction(companyId, "update_limit", "company", `Updated open job limit for ${current?.name ?? companyId}`, {
      previous: current?.jobLimit,
      next: n,
    });
    toast.success("Open job limit updated");
    setEditingLimitId(null);
    fetchCompanies();
  };

  const toggleStatus = async (tenant: (typeof snapshots)[number], next: "active" | "suspended" | "archived") => {
    const verb = next === "active" ? "Reactivate" : next === "archived" ? "Archive" : "Suspend";
    const warning = next === "active"
      ? ""
      : next === "archived"
        ? "Archived tenants should not be accepting new work."
        : "All users will be locked out and public links will stop working.";
    if (!confirm(`${verb} "${tenant.name}"? ${warning}`)) return;
    const { error } = await adminDb.from("companies").update({ status: next }).eq("id", tenant.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const summary =
      next === "active"
        ? `Reactivated tenant ${tenant.name}`
        : next === "archived"
          ? `Archived tenant ${tenant.name}`
          : `Suspended tenant ${tenant.name}`;
    await logAction(tenant.id, `tenant_${next}`, "company", summary, { previous: tenant.status, next });
    toast.success(`${tenant.name} ${next}`);
    fetchCompanies();
  };

  const exportCsv = () => {
    downloadCsv(
      `tenant-directory-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Tenant", "Status", "Plan", "Users", "Jobs", "Open Jobs", "Last Activity", "Alerts", "Created"],
      filtered.map((tenant) => [
        tenant.name,
        tenant.status,
        tenant.planLabel,
        tenant.users,
        tenant.jobs,
        `${tenant.openJobs}/${tenant.jobLimit}`,
        tenant.lastActivityAt ?? "",
        alertCountByTenant.get(tenant.id) ?? 0,
        tenant.createdAt,
      ]),
    );
    toast.success("CSV export downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {snapshots.length} tenants, {alerts.length} alerts, and {filtered.length} visible in the current filter set.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="active:scale-[0.97] transition-transform">
                <Plus className="w-4 h-4 mr-2" /> New Company
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company Name</Label>
                  <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Acme Corp" required />
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Admin User</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Full Name</Label>
                      <Input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Jane Smith" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Email</Label>
                      <Input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="jane@acme.com" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Temporary Password</Label>
                      <Input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required minLength={6} />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full active:scale-[0.97] transition-transform" disabled={creating}>
                  {creating ? "Creating..." : "Create Company & Admin"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-1 text-2xl font-semibold">{snapshots.filter((tenant) => tenant.status === "active").length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Suspended / archived</div>
          <div className="mt-1 text-2xl font-semibold">{snapshots.filter((tenant) => tenant.status !== "active").length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Limit pressure</div>
          <div className="mt-1 text-2xl font-semibold">{snapshots.filter((tenant) => tenant.openJobUsagePct >= 80).length}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Needs attention</div>
          <div className="mt-1 text-2xl font-semibold">{alerts.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "80ms" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies or slugs..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof STATUS_OPTIONS)[number])}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={(value) => setPlanFilter(value as (typeof PLAN_OPTIONS)[number])}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((plan) => (
              <SelectItem key={plan} value={plan} className="capitalize">{plan}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-fade-in" style={{ animationDelay: "140ms" }}>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "all" || planFilter !== "all" ? "No companies match your filters" : "No companies yet"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Jobs</TableHead>
                <TableHead className="text-center">Open / Limit</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-center">Alerts</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(tenant.status)}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.planVariant === "custom" ? "outline" : "secondary"}>{tenant.planLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Users className="w-3 h-3" /> {tenant.users}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Briefcase className="w-3 h-3" /> {tenant.jobs}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {editingLimitId === tenant.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-sm tabular-nums text-muted-foreground">{tenant.openJobs} /</span>
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={editingLimitValue}
                          onChange={(event) => setEditingLimitValue(event.target.value)}
                          className="h-7 w-16 text-sm text-center"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveLimit(tenant.id)}>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditLimit}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditLimit(tenant.id, tenant.jobLimit)}
                        className="inline-flex items-center gap-1.5 text-sm tabular-nums hover:text-primary transition-colors group"
                        title="Click to edit limit"
                      >
                        <span className={tenant.openJobs >= tenant.jobLimit ? "text-destructive font-medium" : ""}>
                          {tenant.openJobs}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span>{tenant.jobLimit}</span>
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-3.5 h-3.5" />
                      {tenant.lastActivityAt ? new Date(tenant.lastActivityAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No activity"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {alertCountByTenant.get(tenant.id) ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {alertCountByTenant.get(tenant.id)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-8" asChild>
                        <Link to={`/admin/companies/${tenant.id}`} title="Open tenant detail">
                          <Settings className="w-3.5 h-3.5 mr-1.5" /> Manage
                        </Link>
                      </Button>
                      {tenant.status === "active" ? (
                        <>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => toggleStatus(tenant, "suspended")} title="Suspend tenant">
                            <Ban className="w-3.5 h-3.5 mr-1.5" /> Suspend
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => toggleStatus(tenant, "archived")} title="Archive tenant">
                            <FileText className="w-3.5 h-3.5 mr-1.5" /> Archive
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => toggleStatus(tenant, "active")} title="Reactivate tenant">
                          <Power className="w-3.5 h-3.5 mr-1.5" /> Reactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
