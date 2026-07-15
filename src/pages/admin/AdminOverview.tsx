import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Building2, CheckCircle2, Cloud, Download, FileText, Layers3, Mail, ShieldAlert, Sparkles, Users, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RangeFilter } from "@/components/dashboard/RangeFilter";
import { BentoGrid, BentoTile } from "@/components/dashboard/BentoGrid";
import { KpiTile } from "@/components/dashboard/KpiTile";
import PageHeader from "@/components/shared/PageHeader";
import { rangeBounds, rangeToDays, bucketByDay, deltaPct, inRange, type RangeKey } from "@/lib/dashboardMetrics";
import {
  buildTenantAlerts,
  buildTenantSnapshots,
  downloadCsv,
  type AdminActionRow,
  type AdminAlert,
  type AdminApplicationRow,
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
} from "@/lib/adminConsole";
import { toast } from "sonner";

type QueryError = { message: string } | null;
type UntypedQuery = PromiseLike<{ data: unknown; error: QueryError }> & {
  limit: (count: number) => UntypedQuery;
  maybeSingle: () => UntypedQuery;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery;
  select: (columns?: string) => UntypedQuery;
};
type UntypedSupabase = {
  from: (table: string) => UntypedQuery;
};

const adminDb = supabase as unknown as UntypedSupabase;

type LoadState = {
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
  adminActions: AdminActionRow[];
};

const INITIAL_LOAD: LoadState = {
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
  adminActions: [],
};

function formatDateInput(value: string | null) {
  return value ?? "";
}

export default function AdminOverview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoadState>(INITIAL_LOAD);

  useEffect(() => {
    const load = async () => {
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
        adminActionsRes,
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
        adminDb.from("super_admin_action_log").select("*").order("created_at", { ascending: false }).limit(25),
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
        adminActions: (adminActionsRes.data ?? []) as AdminActionRow[],
      });
      setLoading(false);
    };

    load();
  }, []);

  const companySnapshots = useMemo(() => buildTenantSnapshots(data), [data]);
  const alerts = useMemo(() => buildTenantAlerts(companySnapshots), [companySnapshots]);

  const customWindow = Boolean(fromDate || toDate);
  const presetBounds = rangeBounds(range);
  const windowFrom = customWindow ? (fromDate ? new Date(`${fromDate}T00:00:00`) : null) : presetBounds.from;
  const windowTo = customWindow ? (toDate ? new Date(`${toDate}T23:59:59.999`) : null) : presetBounds.prevTo;
  const previousWindow = customWindow ? null : { from: presetBounds.prevFrom, to: presetBounds.prevTo };

  const appsInWindow = useMemo(
    () => (windowFrom || windowTo ? inRange(data.applications, "created_at", windowFrom, windowTo) : data.applications),
    [data.applications, windowFrom, windowTo],
  );
  const appsPrevWindow = useMemo(
    () => (previousWindow?.from && previousWindow?.to ? inRange(data.applications, "created_at", previousWindow.from, previousWindow.to) : []),
    [data.applications, previousWindow],
  );
  const emailsInWindow = useMemo(
    () => (windowFrom || windowTo ? inRange(data.emailLogs, "created_at", windowFrom, windowTo) : data.emailLogs),
    [data.emailLogs, windowFrom, windowTo],
  );

  const days = customWindow && windowFrom && windowTo
    ? Math.max(7, Math.ceil((windowTo.getTime() - windowFrom.getTime()) / 86400000) + 1)
    : rangeToDays(range) ?? 30;

  const applicationsTrend = useMemo(() => bucketByDay(appsInWindow, "created_at", days), [appsInWindow, days]);
  const emailsTrend = useMemo(() => bucketByDay(emailsInWindow, "created_at", days), [emailsInWindow, days]);

  const activeTenants = companySnapshots.filter((tenant) => tenant.status === "active").length;
  const inactiveTenants = companySnapshots.filter((tenant) => tenant.status === "suspended" || tenant.status === "archived").length;
  const overdueTenants = companySnapshots.filter((tenant) => tenant.overdueInvoices > 0).length;
  const limitPressureTenants = companySnapshots.filter((tenant) => tenant.openJobUsagePct >= 80).length;
  const billingMissingTenants = companySnapshots.filter((tenant) => !tenant.billingReady).length;
  const highAttentionTenants = companySnapshots.filter((tenant) => tenant.openJobs >= tenant.jobLimit || tenant.overdueInvoices > 0 || !tenant.billingReady).length;

  const totalStorageBytes = companySnapshots.reduce((sum, tenant) => sum + tenant.storageBytes, 0);
  const totalStorageGb = totalStorageBytes / 1024 / 1024 / 1024;
  const totalUsers = data.profiles.filter((profile) => profile.company_id).length;
  const totalJobs = data.jobs.length;
  const totalScreenings = data.screeningSubmissions.length;
  const totalEmails = data.emailLogs.length;
  const overdueInvoices = data.invoices.filter((invoice) => {
    const due = invoice.due_at ? new Date(invoice.due_at).getTime() : null;
    const paid = invoice.paid_at ? new Date(invoice.paid_at).getTime() : null;
    return invoice.status !== "paid" && invoice.status !== "void" && due != null && due < Date.now() && paid == null;
  });
  const paidInvoices = data.invoices.filter((invoice) => invoice.status === "paid").length;

  const topActivity = [...companySnapshots]
    .sort((a, b) => (b.applications + b.screeningSubmissions + b.emailEvents) - (a.applications + a.screeningSubmissions + a.emailEvents))
    .slice(0, 5);

  const topStorage = [...companySnapshots]
    .sort((a, b) => b.storageBytes - a.storageBytes)
    .slice(0, 5);

  const currentAlertCount = alerts.length;
  const alertCounts = alerts.reduce<Record<string, number>>((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] ?? 0) + 1;
    return acc;
  }, {});

  const totalsDelta = customWindow
    ? null
    : deltaPct(appsInWindow.length, appsPrevWindow.length);

  const exportCurrentSnapshot = () => {
    const filename = `super-admin-tenant-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(
      filename,
      [
        "Tenant",
        "Status",
        "Users",
        "Jobs",
        "Open Jobs",
        "Candidates",
        "Applications",
        "Screenings",
        "Email Events",
        "Invoices",
        "Overdue Invoices",
        "Storage GB",
        "Open Job Headroom",
        "Seat Headroom",
        "Last Activity",
        "Plan",
      ],
      companySnapshots.map((tenant) => [
        tenant.name,
        tenant.status,
        tenant.users,
        tenant.jobs,
        tenant.openJobs,
        tenant.candidates,
        tenant.applications,
        tenant.screeningSubmissions,
        tenant.emailEvents,
        tenant.invoices,
        tenant.overdueInvoices,
        (tenant.storageBytes / 1024 / 1024 / 1024).toFixed(2),
        tenant.openJobHeadroom,
        tenant.seatHeadroom,
        tenant.lastActivityAt ?? "",
        tenant.planLabel,
      ]),
    );
    toast.success("CSV export downloaded");
  };

  const topTenantPie = companySnapshots.slice(0, 5).map((tenant) => ({ name: tenant.name, value: tenant.applications + tenant.screeningSubmissions + tenant.emailEvents }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Overview"
        description="Support-first visibility into tenant health, adoption, billing, and platform activity."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCurrentSnapshot} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Usage window</div>
          <RangeFilter value={range} onChange={setRange} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">From</label>
            <Input type="date" value={formatDateInput(fromDate)} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">To</label>
            <Input type="date" value={formatDateInput(toDate)} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <Button variant="ghost" onClick={() => { setFromDate(""); setToDate(""); }}>
            Clear custom range
          </Button>
        </div>
      </div>

      <BentoGrid>
        <BentoTile delay={0}>
          <KpiTile label="Tenants" value={companySnapshots.length} icon={Building2} loading={loading} />
        </BentoTile>
        <BentoTile delay={60}>
          <KpiTile label="Active tenants" value={activeTenants} icon={CheckCircle2} iconAccent="bg-emerald-500/10 text-emerald-600" loading={loading} />
        </BentoTile>
        <BentoTile delay={120}>
          <KpiTile label="Users" value={totalUsers} icon={Users} iconAccent="bg-primary/10 text-primary" loading={loading} />
        </BentoTile>
        <BentoTile delay={180}>
          <KpiTile label="Open jobs" value={totalJobs} icon={Briefcase} iconAccent="bg-amber-500/10 text-amber-600" loading={loading} />
        </BentoTile>
        <BentoTile delay={240}>
          <KpiTile label="Applications" value={appsInWindow.length} delta={totalsDelta} icon={FileText} spark={applicationsTrend} loading={loading} />
        </BentoTile>
        <BentoTile delay={300}>
          <KpiTile label="Screenings" value={totalScreenings} icon={Sparkles} iconAccent="bg-cyan-500/10 text-cyan-600" loading={loading} />
        </BentoTile>
        <BentoTile delay={360}>
          <KpiTile label="Emails" value={totalEmails} icon={Mail} iconAccent="bg-violet-500/10 text-violet-600" spark={emailsTrend} loading={loading} />
        </BentoTile>
        <BentoTile delay={420}>
          <KpiTile label="Storage" value={totalStorageGb.toFixed(1)} suffix="GB" icon={Cloud} iconAccent="bg-slate-500/10 text-slate-600" loading={loading} />
        </BentoTile>
      </BentoGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Activity trends</CardTitle>
              <p className="text-sm text-muted-foreground">Applications, emails, and candidate growth in the selected period.</p>
            </div>
            <Badge variant="secondary">{days} day window</Badge>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={applicationsTrend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#overviewApps)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emailsTrend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant mix</CardTitle>
            <p className="text-sm text-muted-foreground">How the busiest tenants are contributing to platform activity.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topTenantPie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={74} paddingAngle={3}>
                    {topTenantPie.map((entry, index) => (
                      <Cell key={entry.name} fill={`hsl(var(--chart-${(index % 6) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">High attention tenants</span>
                <Badge variant={highAttentionTenants > 0 ? "destructive" : "secondary"}>{highAttentionTenants}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overdue invoice tenants</span>
                <Badge variant={overdueTenants > 0 ? "destructive" : "secondary"}>{overdueTenants}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Billing profiles missing</span>
                <Badge variant={billingMissingTenants > 0 ? "destructive" : "secondary"}>{billingMissingTenants}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Limit pressure</span>
                <Badge variant={limitPressureTenants > 0 ? "destructive" : "secondary"}>{limitPressureTenants}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Needs attention</CardTitle>
              <p className="text-sm text-muted-foreground">The tenants most likely to need a support touch.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">{alertCounts.high ?? 0} high</Badge>
              <Badge variant="secondary">{currentAlertCount} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 6).map((alert: AdminAlert) => (
              <div key={alert.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alert.companyName}</span>
                      <Badge
                        variant={alert.severity === "high" ? "destructive" : alert.severity === "medium" ? "secondary" : "outline"}
                        className={alert.severity === "low" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : undefined}
                      >
                        {alert.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </div>
            ))}
            {alerts.length === 0 && <p className="py-4 text-sm text-muted-foreground text-center">No active alerts right now.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform summary</CardTitle>
            <p className="text-sm text-muted-foreground">Counts that help you make product and revenue decisions.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Inactive tenants</div>
              <div className="mt-1 text-xl font-semibold">{inactiveTenants}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Overdue invoices</div>
              <div className="mt-1 text-xl font-semibold">{overdueInvoices.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Paid invoices</div>
              <div className="mt-1 text-xl font-semibold">{paidInvoices}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Peak apps window</div>
              <div className="mt-1 text-xl font-semibold">{appsInWindow.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current screenings</div>
              <div className="mt-1 text-xl font-semibold">{totalScreenings}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current storage</div>
              <div className="mt-1 text-xl font-semibold">{totalStorageGb.toFixed(1)} GB</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BentoGrid>
        <BentoTile colSpan={2} rowSpan={2} delay={60}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Top tenants by activity</h2>
              <p className="text-xs text-muted-foreground">Applications, screenings, and email volume combined.</p>
            </div>
            <Badge variant="secondary">{topActivity.length} shown</Badge>
          </div>
          <div className="space-y-3">
            {topActivity.map((tenant, index) => (
              <div key={tenant.id} className="grid grid-cols-[20px_1fr_72px] items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">#{index + 1}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tenant.name}</span>
                    <Badge variant={tenant.status === "active" ? "secondary" : "destructive"} className={tenant.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : undefined}>
                      {tenant.status}
                    </Badge>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, Math.min(100, ((tenant.applications + tenant.screeningSubmissions + tenant.emailEvents) / Math.max(1, topActivity[0]?.applications + topActivity[0]?.screeningSubmissions + topActivity[0]?.emailEvents)) * 100))}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-right">
                  {tenant.applications + tenant.screeningSubmissions + tenant.emailEvents}
                </span>
              </div>
            ))}
            {topActivity.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No activity in this window yet.</p>}
          </div>
        </BentoTile>

        <BentoTile colSpan={2} rowSpan={2} delay={120}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Largest storage tenants</h2>
              <p className="text-xs text-muted-foreground">Resume and video storage footprint by tenant.</p>
            </div>
            <Badge variant="secondary">{topStorage.length} shown</Badge>
          </div>
          <div className="space-y-3">
            {topStorage.map((tenant, index) => (
              <div key={tenant.id} className="grid grid-cols-[20px_1fr_72px] items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">#{index + 1}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tenant.name}</span>
                    <Badge variant="outline">{tenant.planLabel}</Badge>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(8, Math.min(100, (tenant.storageBytes / Math.max(1, topStorage[0]?.storageBytes)) * 100))}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-right">
                  {(tenant.storageBytes / 1024 / 1024 / 1024).toFixed(1)} GB
                </span>
              </div>
            ))}
            {topStorage.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No storage usage yet.</p>}
          </div>
        </BentoTile>
      </BentoGrid>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Recent admin actions</CardTitle>
            <p className="text-sm text-muted-foreground">Latest cross-tenant changes and support actions.</p>
          </div>
          <ShieldAlert className="w-5 h-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {data.adminActions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            data.adminActions.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{entry.action}</Badge>
                    <span className="text-sm font-medium">{entry.summary}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.entity_type}{entry.entity_id ? ` · ${entry.entity_id}` : ""} · {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                <Layers3 className="w-4 h-4 text-muted-foreground/40" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
