import { missingBillingFields } from "@/lib/billingProfile";

export type TenantStatus = "active" | "suspended" | "archived" | string;

export interface AdminCompanyRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus | null;
  max_open_jobs: number;
  created_at: string;
}

export interface AdminProfileRow {
  company_id: string | null;
}

export interface AdminJobRow {
  id?: string;
  title?: string | null;
  company_id: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  hiring_manager?: string | null;
}

export interface AdminCandidateRow {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  country?: string | null;
  parish_state?: string | null;
  street_address?: string | null;
  company_id: string | null;
  created_at: string;
  resume_size_bytes: number | null;
}

export interface AdminApplicationRow {
  company_id: string | null;
  stage: string;
  created_at: string;
  updated_at: string;
  job_id: string;
}

export interface AdminScreeningJobRow {
  id?: string;
  title?: string | null;
  question?: string | null;
  company_id: string | null;
  created_at: string;
  expires_at: string;
}

export interface AdminScreeningSubmissionRow {
  id?: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  company_id: string | null;
  created_at: string;
  status: string;
  upload_status: string | null;
  video_size_bytes: number | null;
}

export interface AdminEmailLogRow {
  company_id: string | null;
  created_at: string;
  status: string;
  error_message: string | null;
  template_key?: string | null;
  recipient_email?: string | null;
}

export interface AdminInvoiceRow {
  id?: string;
  invoice_number?: string | null;
  company_id: string | null;
  status: string | null;
  due_at: string | null;
  issued_at: string | null;
  paid_at: string | null;
  total_cents: number | null;
  created_at: string;
  currency?: string | null;
}

export interface AdminBillingProfileRow {
  company_id: string | null;
  legal_name: string | null;
  billing_email: string | null;
  billing_address: string | null;
}

export interface AdminSubscriptionRow {
  company_id: string;
  override_open_jobs: number | null;
  override_seats: number | null;
  discount_type: string | null;
  discount_value: number | null;
  renewal_date: string | null;
  auto_renew: boolean | null;
}

export interface AdminPlanDefaultsRow {
  included_seats: number;
  included_open_jobs: number;
}

export interface AdminActionRow {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  meta: unknown;
  created_at: string;
}

export interface TenantSnapshot {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  users: number;
  jobs: number;
  openJobs: number;
  candidates: number;
  applications: number;
  screenings: number;
  screeningSubmissions: number;
  emailEvents: number;
  failedEmails: number;
  invoices: number;
  overdueInvoices: number;
  paidInvoices: number;
  jobLimit: number;
  seatLimit: number;
  renewsOn: string | null;
  autoRenew: boolean | null;
  billingReady: boolean;
  billingMissing: string[];
  resumeBytes: number;
  videoBytes: number;
  storageBytes: number;
  lastActivityAt: string | null;
  inactiveDays: number | null;
  planLabel: string;
  planVariant: "standard" | "custom";
  openJobHeadroom: number;
  seatHeadroom: number;
  openJobUsagePct: number;
  seatUsagePct: number;
}

export type AlertSeverity = "high" | "medium" | "low";

export interface AdminAlert {
  id: string;
  companyId: string;
  companyName: string;
  severity: AlertSeverity;
  category: string;
  message: string;
  detail?: string;
}

export interface ConsoleDataInput {
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
}

function asNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function maxIso(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => !!value);
  if (valid.length === 0) return null;
  return valid.reduce((latest, value) => (new Date(value).getTime() > new Date(latest).getTime() ? value : latest));
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Math.floor(ms / 86400000);
}

function sumBytes(values: Array<number | null | undefined>) {
  return values.reduce((sum, value) => sum + asNumber(value), 0);
}

function planVariant(subscription?: AdminSubscriptionRow | null) {
  if (!subscription) return "standard" as const;
  return subscription.override_open_jobs != null ||
    subscription.override_seats != null ||
    subscription.discount_type != null ||
    subscription.discount_value != null
    ? "custom"
    : "standard";
}

export function buildTenantSnapshots(input: ConsoleDataInput): TenantSnapshot[] {
  const usersByCompany = new Map<string, number>();
  input.profiles.forEach((row) => {
    if (!row.company_id) return;
    usersByCompany.set(row.company_id, (usersByCompany.get(row.company_id) ?? 0) + 1);
  });

  const jobsByCompany = new Map<string, { total: number; open: number; latest: string | null }>();
  input.jobs.forEach((row) => {
    if (!row.company_id) return;
    const current = jobsByCompany.get(row.company_id) ?? { total: 0, open: 0, latest: null };
    current.total += 1;
    if (row.status === "open") current.open += 1;
    current.latest = maxIso([current.latest, row.created_at, row.expires_at]);
    jobsByCompany.set(row.company_id, current);
  });

  const candidatesByCompany = new Map<string, { total: number; latest: string | null; resumeBytes: number }>();
  input.candidates.forEach((row) => {
    if (!row.company_id) return;
    const current = candidatesByCompany.get(row.company_id) ?? { total: 0, latest: null, resumeBytes: 0 };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at]);
    current.resumeBytes += asNumber(row.resume_size_bytes);
    candidatesByCompany.set(row.company_id, current);
  });

  const applicationsByCompany = new Map<string, { total: number; latest: string | null }>();
  input.applications.forEach((row) => {
    if (!row.company_id) return;
    const current = applicationsByCompany.get(row.company_id) ?? { total: 0, latest: null };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at, row.updated_at]);
    applicationsByCompany.set(row.company_id, current);
  });

  const screeningJobsByCompany = new Map<string, { total: number; latest: string | null }>();
  input.screeningJobs.forEach((row) => {
    if (!row.company_id) return;
    const current = screeningJobsByCompany.get(row.company_id) ?? { total: 0, latest: null };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at, row.expires_at]);
    screeningJobsByCompany.set(row.company_id, current);
  });

  const screeningSubmissionsByCompany = new Map<string, { total: number; latest: string | null; videoBytes: number; failures: number }>();
  input.screeningSubmissions.forEach((row) => {
    if (!row.company_id) return;
    const current = screeningSubmissionsByCompany.get(row.company_id) ?? { total: 0, latest: null, videoBytes: 0, failures: 0 };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at]);
    current.videoBytes += asNumber(row.video_size_bytes);
    if (row.status !== "completed" && row.status !== "submitted" && row.upload_status && row.upload_status !== "uploaded") {
      current.failures += 1;
    }
    screeningSubmissionsByCompany.set(row.company_id, current);
  });

  const emailLogsByCompany = new Map<string, { total: number; latest: string | null; failures: number }>();
  input.emailLogs.forEach((row) => {
    if (!row.company_id) return;
    const current = emailLogsByCompany.get(row.company_id) ?? { total: 0, latest: null, failures: 0 };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at]);
    if (row.status === "failed") current.failures += 1;
    emailLogsByCompany.set(row.company_id, current);
  });

  const invoicesByCompany = new Map<string, { total: number; overdue: number; paid: number; latest: string | null }>();
  input.invoices.forEach((row) => {
    if (!row.company_id) return;
    const current = invoicesByCompany.get(row.company_id) ?? { total: 0, overdue: 0, paid: 0, latest: null };
    current.total += 1;
    current.latest = maxIso([current.latest, row.created_at, row.issued_at, row.paid_at, row.due_at]);
    if (row.status === "paid") current.paid += 1;
    const due = row.due_at ? new Date(row.due_at).getTime() : null;
    const paid = row.paid_at ? new Date(row.paid_at).getTime() : null;
    if (row.status !== "paid" && row.status !== "void" && due != null && due < Date.now() && paid == null) {
      current.overdue += 1;
    }
    invoicesByCompany.set(row.company_id, current);
  });

  const billingProfiles = new Map<string, AdminBillingProfileRow>();
  input.billingProfiles.forEach((row) => {
    if (!row.company_id) return;
    billingProfiles.set(row.company_id, row);
  });

  const subscriptions = new Map<string, AdminSubscriptionRow>();
  input.subscriptions.forEach((row) => subscriptions.set(row.company_id, row));

  return input.companies.map((company) => {
    const users = usersByCompany.get(company.id) ?? 0;
    const jobs = jobsByCompany.get(company.id) ?? { total: 0, open: 0, latest: null };
    const candidates = candidatesByCompany.get(company.id) ?? { total: 0, latest: null, resumeBytes: 0 };
    const applications = applicationsByCompany.get(company.id) ?? { total: 0, latest: null };
    const screenings = screeningJobsByCompany.get(company.id) ?? { total: 0, latest: null };
    const screeningSubmissions = screeningSubmissionsByCompany.get(company.id) ?? { total: 0, latest: null, videoBytes: 0, failures: 0 };
    const emailLogs = emailLogsByCompany.get(company.id) ?? { total: 0, latest: null, failures: 0 };
    const invoiceStats = invoicesByCompany.get(company.id) ?? { total: 0, overdue: 0, paid: 0, latest: null };
    const billingProfile = billingProfiles.get(company.id) ?? null;
    const subscription = subscriptions.get(company.id) ?? null;
    const defaults = input.planDefaults;
    const openJobLimit = asNumber(subscription?.override_open_jobs, company.max_open_jobs || defaults?.included_open_jobs || 0);
    const seatLimit = asNumber(subscription?.override_seats, defaults?.included_seats ?? 0);
    const billingMissing = missingBillingFields(billingProfile);
    const storageBytes = sumBytes([candidates.resumeBytes, screeningSubmissions.videoBytes]);
    const lastActivityAt = maxIso([
      company.created_at,
      jobs.latest,
      candidates.latest,
      applications.latest,
      screenings.latest,
      screeningSubmissions.latest,
      emailLogs.latest,
      invoiceStats.latest,
    ]);
    const inactiveDays = daysSince(lastActivityAt);
    const openJobHeadroom = openJobLimit - jobs.open;
    const seatHeadroom = seatLimit - users;
    const openJobUsagePct = openJobLimit > 0 ? Math.min(999, (jobs.open / openJobLimit) * 100) : 0;
    const seatUsagePct = seatLimit > 0 ? Math.min(999, (users / seatLimit) * 100) : 0;
    const variant = planVariant(subscription);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status ?? "active",
      createdAt: company.created_at,
      users,
      jobs: jobs.total,
      openJobs: jobs.open,
      candidates: candidates.total,
      applications: applications.total,
      screenings: screenings.total,
      screeningSubmissions: screeningSubmissions.total,
      emailEvents: emailLogs.total,
      failedEmails: emailLogs.failures,
      invoices: invoiceStats.total,
      overdueInvoices: invoiceStats.overdue,
      paidInvoices: invoiceStats.paid,
      jobLimit: openJobLimit,
      seatLimit,
      renewsOn: subscription?.renewal_date ?? null,
      autoRenew: subscription?.auto_renew ?? null,
      billingReady: billingMissing.length === 0,
      billingMissing,
      resumeBytes: candidates.resumeBytes,
      videoBytes: screeningSubmissions.videoBytes,
      storageBytes,
      lastActivityAt,
      inactiveDays,
      planLabel: variant === "custom" ? "Custom" : "Standard",
      planVariant: variant,
      openJobHeadroom,
      seatHeadroom,
      openJobUsagePct,
      seatUsagePct,
    };
  });
}

export function buildTenantAlerts(tenants: TenantSnapshot[]): AdminAlert[] {
  const alerts: AdminAlert[] = [];

  tenants.forEach((tenant) => {
    if (tenant.status !== "active") {
      alerts.push({
        id: `${tenant.id}-status`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: tenant.status === "archived" ? "medium" : "low",
        category: "Lifecycle",
        message: `Tenant is ${tenant.status}.`,
      });
    }
    if ((tenant.jobLimit > 0 && tenant.openJobs >= tenant.jobLimit) || (tenant.jobLimit === 0 && tenant.openJobs > 0)) {
      alerts.push({
        id: `${tenant.id}-jobs`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: "high",
        category: "Limit pressure",
        message: `Open jobs are at ${tenant.openJobs}/${tenant.jobLimit}.`,
      });
    }
    if (tenant.overdueInvoices > 0) {
      alerts.push({
        id: `${tenant.id}-billing`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: "high",
        category: "Billing",
        message: `${tenant.overdueInvoices} overdue invoice${tenant.overdueInvoices === 1 ? "" : "s"}.`,
      });
    }
    if (!tenant.billingReady) {
      alerts.push({
        id: `${tenant.id}-profile`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: "medium",
        category: "Billing setup",
        message: `Billing profile is missing: ${tenant.billingMissing.join(", ")}.`,
      });
    }
    if (tenant.failedEmails > 0) {
      alerts.push({
        id: `${tenant.id}-emails`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: tenant.failedEmails > 3 ? "high" : "medium",
        category: "Delivery",
        message: `${tenant.failedEmails} failed email event${tenant.failedEmails === 1 ? "" : "s"}.`,
      });
    }
    if (tenant.inactiveDays != null && tenant.inactiveDays >= 30 && tenant.status === "active") {
      alerts.push({
        id: `${tenant.id}-inactive`,
        companyId: tenant.id,
        companyName: tenant.name,
        severity: tenant.inactiveDays >= 60 ? "high" : "medium",
        category: "Inactivity",
        message: `No activity for ${tenant.inactiveDays} days.`,
      });
    }
    if (tenant.autoRenew === false && tenant.renewsOn) {
      const daysToRenewal = Math.ceil((new Date(tenant.renewsOn).getTime() - Date.now()) / 86400000);
      if (daysToRenewal <= 30) {
        alerts.push({
          id: `${tenant.id}-renewal`,
          companyId: tenant.id,
          companyName: tenant.name,
          severity: daysToRenewal <= 7 ? "high" : "low",
          category: "Renewal",
          message: `Auto-renew is off and renewal is in ${daysToRenewal} day${daysToRenewal === 1 ? "" : "s"}.`,
        });
      }
    }
  });

  return alerts.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 } as const;
    return rank[b.severity] - rank[a.severity] || a.companyName.localeCompare(b.companyName);
  });
}

export function filterTenants(tenants: TenantSnapshot[], query: { search: string; status: string; plan: string }) {
  const needle = query.search.trim().toLowerCase();
  return tenants.filter((tenant) => {
    if (query.status !== "all" && tenant.status !== query.status) return false;
    if (query.plan !== "all" && tenant.planVariant !== query.plan) return false;
    if (!needle) return true;
    return tenant.name.toLowerCase().includes(needle) || tenant.slug.toLowerCase().includes(needle);
  });
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => {
    if (value == null) return "";
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
