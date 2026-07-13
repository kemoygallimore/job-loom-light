import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

interface EmailTemplate {
  id?: string;
  company_id?: string | null;
  key?: string;
  name?: string;
  purpose?: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  is_active: boolean;
  archived_at?: string | null;
}

interface CompanyEmailSettings {
  id: string;
  name: string | null;
  email_domain: string | null;
  email_domain_status: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
}

interface SendEmailArgs {
  templateKey: string;
  recipient: string;
  variables: Record<string, string>;
  company: CompanyEmailSettings | null;
  companyId?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  test?: boolean;
}

interface AuthenticatedProfile {
  userId: string;
  companyId: string;
}

type AuthenticatedProfileResult =
  | { ok: false; response: Response }
  | { ok: true; profile: AuthenticatedProfile };

type SuperAdminResult =
  | { ok: false; response: Response }
  | { ok: true; userId: string };

type TemplateResult =
  | { ok: false; response: Response }
  | { ok: true; template: EmailTemplate };

interface RenderedEmailArgs {
  templateKey: string;
  templateName?: string;
  recipient: string;
  subject: string;
  html: string;
  variables: Record<string, string>;
  company: CompanyEmailSettings | null;
  companyId?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
}

interface CompanyEmailTemplate {
  id: string;
  company_id: string | null;
  key: string;
  name: string;
  purpose: CandidateEmailPurpose;
  subject: string;
  html_body: string;
  text_body: string | null;
  is_active: boolean;
  archived_at: string | null;
}

interface CandidateEmailRecipientInput {
  candidate_id?: string | null;
  application_id?: string | null;
}

interface CandidateEmailCandidateRow {
  id: string;
  company_id: string;
  name: string | null;
  email: string | null;
}

interface CandidateEmailJobRow {
  title: string | null;
}

interface CandidateEmailApplicationRow {
  id: string;
  company_id: string;
  candidate_id: string;
  job_id: string | null;
  candidates: CandidateEmailCandidateRow | CandidateEmailCandidateRow[] | null;
  jobs: CandidateEmailJobRow | CandidateEmailJobRow[] | null;
}

interface LeadFormRow {
  id: string;
  title: string;
  public_id: string;
}

interface ScreeningJobRow {
  id: string;
  title: string;
  job_id: string | null;
  unique_link_id: string;
  expires_at: string;
}

type CandidateEmailPurpose = "general" | "form_link" | "video_screening" | "rejection";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RIZONHIRE_FROM_EMAIL") ?? "RizonHire <no-reply@rizonhire.com>";
const CANDIDATE_EMAIL_PURPOSES = new Set<CandidateEmailPurpose>(["general", "form_link", "video_screening", "rejection"]);

const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.rizonhire.com",
  "https://test.rizonhire.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || allowedOrigins.includes(origin);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizeText(value: unknown, maxLength = 2000) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeBody(value: unknown, maxLength = 20000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]!));
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function render(template: string, vars: Record<string, string>, escapeValues = false) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key] ?? "";
    return escapeValues ? escapeHtml(value) : value;
  });
}

function normalizeVariables(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 50);
  return Object.fromEntries(entries.map(([key, value]) => [key, normalizeText(value)]));
}

function normalizeApplicationIds(input: unknown) {
  if (!Array.isArray(input)) return [];
  const ids = input.map((id) => normalizeText(id, 80)).filter(Boolean);
  return Array.from(new Set(ids));
}

function normalizeCandidateEmailPurpose(value: unknown): CandidateEmailPurpose {
  const normalized = normalizeText(value, 40) as CandidateEmailPurpose;
  return CANDIDATE_EMAIL_PURPOSES.has(normalized) ? normalized : "general";
}

function requiredTokenForPurpose(purpose: CandidateEmailPurpose) {
  if (purpose === "form_link") return "form_link";
  if (purpose === "video_screening") return "screening_link";
  return null;
}

function containsVariableToken(subject: string, html: string, variable: string) {
  return new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`).test(`${subject}\n${html}`);
}

function requestOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins.includes(origin)) return origin;
  return "https://app.rizonhire.com";
}

function normalizeCandidateEmailRecipients(input: unknown): CandidateEmailRecipientInput[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const recipients: CandidateEmailRecipientInput[] = [];

  for (const row of input.slice(0, 100)) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const candidateId = normalizeText(record.candidate_id, 80);
    const applicationId = normalizeText(record.application_id, 80);
    if (!candidateId && !applicationId) continue;

    const key = `${candidateId}:${applicationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({
      candidate_id: candidateId || null,
      application_id: applicationId || null,
    });
  }

  return recipients;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function requireSuperAdmin(req: Request, admin: SupabaseAdmin): Promise<SuperAdminResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, response: json(req, 401, { error: "Unauthorized" }) };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  const user = userData?.user;
  if (error || !user) return { ok: false, response: json(req, 401, { error: "Unauthorized" }) };

  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !roleRow) return { ok: false, response: json(req, 403, { error: "Forbidden" }) };
  return { ok: true, userId: user.id };
}

async function requireAuthenticatedProfile(req: Request, admin: SupabaseAdmin): Promise<AuthenticatedProfileResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, response: json(req, 401, { error: "Unauthorized" }) };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  const user = userData?.user;
  if (error || !user) return { ok: false, response: json(req, 401, { error: "Unauthorized" }) };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("user_id, company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.company_id) {
    return { ok: false, response: json(req, 403, { error: "Company profile not found" }) };
  }

  return { ok: true, profile: { userId: user.id, companyId: profile.company_id } as AuthenticatedProfile };
}

async function resolveEmailTemplate(
  req: Request,
  admin: SupabaseAdmin,
  args: {
    companyId?: string | null;
    templateId?: string | null;
    templateKey?: string | null;
    purpose?: CandidateEmailPurpose | "general";
    includeInactive?: boolean;
  },
): Promise<TemplateResult> {
  const { data: tpl, error: tplErr } = await admin
    .rpc("resolve_email_template", {
      _company_id: args.companyId ?? null,
      _template_id: args.templateId ?? null,
      _template_key: args.templateKey ?? null,
      _purpose: args.purpose ?? "general",
      _include_inactive: args.includeInactive ?? false,
    })
    .maybeSingle();

  if (tplErr || !tpl) return { ok: false, response: json(req, 404, { error: "Template not found" }) };
  const template = tpl as EmailTemplate;
  if ((!template.is_active || template.archived_at) && !args.includeInactive) {
    return { ok: false, response: json(req, 400, { error: "Template is disabled" }) };
  }
  return { ok: true, template };
}

function resolveSender(company: CompanyEmailSettings | null) {
  let fromAddress = FROM_ADDRESS;
  let replyTo: string | undefined;

  if (company?.email_domain && company.email_domain_status === "verified") {
    const displayName = normalizeText(company.email_from_name || company.name || "Careers", 80).replace(/[<>"]/g, "");
    fromAddress = `${displayName} <no-reply@${company.email_domain}>`;
    replyTo = company.email_reply_to || undefined;
  }

  return { fromAddress, replyTo };
}

async function sendEmail(
  req: Request,
  admin: SupabaseAdmin,
  args: SendEmailArgs,
) {
  if (!RESEND_API_KEY) return json(req, 500, { error: "RESEND_API_KEY not configured" });

  const templateResult = await resolveEmailTemplate(req, admin, {
    companyId: args.companyId ?? null,
    templateKey: args.templateKey,
    purpose: "general",
    includeInactive: args.test,
  });
  if (!templateResult.ok) return templateResult.response;
  const tpl = templateResult.template;

  const { fromAddress, replyTo } = resolveSender(args.company);
  const subject = normalizeSubject(render(tpl.subject, args.variables));
  const html = render(tpl.html_body, args.variables, true);
  const text = htmlToPlainText(html);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: fromAddress, to: [args.recipient], subject, html, text, reply_to: replyTo }),
  });

  const resendData = await resendRes.json().catch(() => ({} as Record<string, unknown>));
  const logRow = {
    template_key: args.templateKey,
    recipient_email: args.recipient,
    company_id: args.companyId ?? null,
    candidate_id: args.candidateId ?? null,
    application_id: args.applicationId ?? null,
    context: args.variables,
    from_address: fromAddress,
    reply_to: replyTo ?? null,
  };

  if (!resendRes.ok) {
    await admin.from("email_send_log").insert({
      ...logRow,
      status: "failed",
      error_message: JSON.stringify(resendData).slice(0, 1000),
    });
    return json(req, 502, { error: "Resend failed", details: resendData });
  }

  await admin.from("email_send_log").insert({
    ...logRow,
    status: "sent",
    provider_message_id: resendData?.id ?? null,
  });

  return json(req, 200, { ok: true, id: resendData?.id });
}

async function sendRenderedEmail(admin: SupabaseAdmin, args: RenderedEmailArgs) {
  const { fromAddress, replyTo } = resolveSender(args.company);
  const logRow = {
    template_key: args.templateKey,
    recipient_email: args.recipient,
    company_id: args.companyId ?? null,
    candidate_id: args.candidateId ?? null,
    application_id: args.applicationId ?? null,
    context: {
      ...args.variables,
      template_name: args.templateName ?? args.templateKey,
      subject: args.subject,
    },
    from_address: fromAddress,
    reply_to: replyTo ?? null,
  };

  if (!RESEND_API_KEY) {
    await admin.from("email_send_log").insert({
      ...logRow,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: fromAddress,
      to: [args.recipient],
      subject: args.subject,
      html: args.html,
      text: htmlToPlainText(args.html),
      reply_to: replyTo,
    }),
  });

  const resendData = await resendRes.json().catch(() => ({} as Record<string, unknown>));
  if (!resendRes.ok) {
    await admin.from("email_send_log").insert({
      ...logRow,
      status: "failed",
      error_message: JSON.stringify(resendData).slice(0, 1000),
    });
    return { ok: false, error: "Resend failed", details: resendData };
  }

  await admin.from("email_send_log").insert({
    ...logRow,
    status: "sent",
    provider_message_id: resendData?.id ?? null,
  });

  return { ok: true, id: resendData?.id };
}

async function sendApplicationReceived(req: Request, admin: SupabaseAdmin, body: Record<string, unknown>) {
  const allowedKeys = new Set(["mode", "application_id"]);
  const unsupported = Object.keys(body ?? {}).filter((key) => !allowedKeys.has(key));
  if (unsupported.length > 0) return json(req, 400, { error: "Unsupported fields for application email" });

  const applicationId = normalizeText(body?.application_id, 80);
  if (!applicationId) return json(req, 400, { error: "application_id is required" });

  const { data: app, error: appError } = await admin
    .from("applications")
    .select("id, company_id, job_id, candidate_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (appError || !app) return json(req, 404, { error: "Application not found" });

  const { data: duplicate, error: duplicateError } = await admin
    .from("email_send_log")
    .select("id")
    .eq("template_key", "application_received")
    .eq("application_id", app.id)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (duplicateError) return json(req, 500, { error: "Could not verify email send status" });
  if (duplicate) return json(req, 200, { ok: true, duplicate: true });

  const [candidateRes, jobRes, companyRes] = await Promise.all([
    admin
      .from("candidates")
      .select("name, email, company_id")
      .eq("id", app.candidate_id)
      .eq("company_id", app.company_id)
      .maybeSingle(),
    admin
      .from("jobs")
      .select("title, company_id")
      .eq("id", app.job_id)
      .eq("company_id", app.company_id)
      .maybeSingle(),
    admin
      .from("companies")
      .select("id, name, email_domain, email_domain_status, email_from_name, email_reply_to")
      .eq("id", app.company_id)
      .maybeSingle(),
  ]);

  if (candidateRes.error || jobRes.error || companyRes.error || !candidateRes.data || !jobRes.data || !companyRes.data) {
    return json(req, 404, { error: "Application email context not found" });
  }

  const recipient = normalizeText(candidateRes.data.email, 320).toLowerCase();
  if (!isValidEmail(recipient)) return json(req, 400, { error: "Candidate email is invalid" });

  return sendEmail(req, admin, {
    templateKey: "application_received",
    recipient,
    variables: {
      candidate_name: normalizeText(candidateRes.data.name, 120),
      company_name: normalizeText(companyRes.data.name, 120),
      job_title: normalizeText(jobRes.data.title, 160),
    },
    company: companyRes.data,
    companyId: app.company_id,
    candidateId: app.candidate_id,
    applicationId: app.id,
  });
}

async function sendCandidateEmail(req: Request, admin: SupabaseAdmin, body: Record<string, unknown>) {
  const allowedKeys = new Set([
    "mode",
    "template_id",
    "purpose",
    "form_id",
    "recipients",
    "subject",
    "html_body",
    "text_body",
    "reject_applications",
  ]);
  const unsupported = Object.keys(body ?? {}).filter((key) => !allowedKeys.has(key));
  if (unsupported.length > 0) return json(req, 400, { error: "Unsupported fields for candidate email" });

  const auth = await requireAuthenticatedProfile(req, admin);
  if (!auth.ok) return auth.response;

  const templateId = normalizeText(body?.template_id, 80);
  const purpose = normalizeCandidateEmailPurpose(body?.purpose);
  const formId = normalizeText(body?.form_id, 80);
  const recipients = normalizeCandidateEmailRecipients(body?.recipients);
  const subjectTemplate = normalizeSubject(String(body?.subject ?? ""));
  const htmlTemplate = normalizeBody(body?.html_body);
  const rejectApplications = body?.reject_applications === true;

  if (recipients.length === 0) return json(req, 400, { error: "recipients are required" });
  if (!subjectTemplate) return json(req, 400, { error: "subject is required" });
  if (!htmlTemplate) return json(req, 400, { error: "html_body is required" });
  const requiredToken = requiredTokenForPurpose(purpose);
  if (requiredToken && !containsVariableToken(subjectTemplate, htmlTemplate, requiredToken)) {
    return json(req, 400, { error: `${requiredToken} is required for this email purpose` });
  }
  if (purpose === "form_link") {
    return json(req, 400, { error: "Shared form links are retired. Use candidate form invitations instead." });
  }
  if (purpose === "form_link" && !formId) {
    return json(req, 400, { error: "form_id is required for form link emails" });
  }

  const templateResult = await resolveEmailTemplate(req, admin, {
    companyId: auth.profile.companyId,
    templateId: templateId || null,
    purpose,
  });
  if (!templateResult.ok) return templateResult.response;

  const clientTemplate = templateResult.template as CompanyEmailTemplate;
  if (clientTemplate.purpose !== purpose) {
    return json(req, 400, { error: "Template purpose does not match this action" });
  }

  const applicationIds = Array.from(new Set(recipients.map((item) => item.application_id).filter(Boolean))) as string[];
  const directCandidateIds = Array.from(new Set(recipients.map((item) => item.candidate_id).filter(Boolean))) as string[];

  const [applicationsResult, candidatesResult, companyResult, leadFormResult, screeningJobsResult] = await Promise.all([
    applicationIds.length > 0
      ? admin
          .from("applications")
          .select("id, company_id, candidate_id, job_id, candidates(name, email), jobs(title)")
          .in("id", applicationIds)
          .eq("company_id", auth.profile.companyId)
      : Promise.resolve({ data: [], error: null }),
    directCandidateIds.length > 0
      ? admin
          .from("candidates")
          .select("id, company_id, name, email")
          .in("id", directCandidateIds)
          .eq("company_id", auth.profile.companyId)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("companies")
      .select("id, name, email_domain, email_domain_status, email_from_name, email_reply_to")
      .eq("id", auth.profile.companyId)
      .maybeSingle(),
    purpose === "form_link"
      ? admin
          .from("lead_forms")
          .select("id, title, public_id")
          .eq("id", formId)
          .eq("company_id", auth.profile.companyId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    purpose === "video_screening"
      ? admin
          .from("screening_jobs")
          .select("id, title, job_id, unique_link_id, expires_at")
          .eq("company_id", auth.profile.companyId)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (applicationsResult.error) return json(req, 500, { error: "Could not load applications" });
  if (candidatesResult.error) return json(req, 500, { error: "Could not load candidates" });
  if (companyResult.error || !companyResult.data) return json(req, 404, { error: "Company email context not found" });
  if (leadFormResult.error) return json(req, 500, { error: "Could not load lead form" });
  if (purpose === "form_link" && !leadFormResult.data) return json(req, 400, { error: "Active lead form not found" });
  if (screeningJobsResult.error) return json(req, 500, { error: "Could not load screening links" });

  const applicationsById = new Map(
    ((applicationsResult.data ?? []) as CandidateEmailApplicationRow[]).map((app) => [app.id, app]),
  );
  const candidatesById = new Map(
    ((candidatesResult.data ?? []) as CandidateEmailCandidateRow[]).map((candidate) => [candidate.id, candidate]),
  );

  if (rejectApplications) {
    if (purpose !== "rejection") {
      return json(req, 400, { error: "Only rejection templates can reject candidates" });
    }
    if (applicationIds.length === 0) {
      return json(req, 400, { error: "Rejection email requires application recipients" });
    }

    const { error: updateError } = await admin
      .from("applications")
      .update({ stage: "rejected" })
      .in("id", applicationIds)
      .eq("company_id", auth.profile.companyId);

    if (updateError) return json(req, 500, { error: "Could not reject candidates" });
  }

  const origin = requestOrigin(req);
  const leadForm = leadFormResult.data as LeadFormRow | null;
  const formLink = leadForm ? `${origin}/forms/${leadForm.public_id}` : "";
  const screeningJobs = ((screeningJobsResult.data ?? []) as ScreeningJobRow[]);
  const screeningJobsByJobId = new Map<string, ScreeningJobRow[]>();
  for (const job of screeningJobs) {
    if (!job.job_id) continue;
    const current = screeningJobsByJobId.get(job.job_id) ?? [];
    current.push(job);
    screeningJobsByJobId.set(job.job_id, current);
  }

  if (purpose === "video_screening") {
    for (const recipientInput of recipients) {
      const app = recipientInput.application_id ? applicationsById.get(recipientInput.application_id) : null;
      if (!app?.job_id) {
        return json(req, 400, { error: "Video screening emails require application recipients with jobs" });
      }

      const matches = screeningJobsByJobId.get(app.job_id) ?? [];
      if (matches.length === 0) {
        return json(req, 400, { error: "Every selected candidate must have an active screening link for their job" });
      }
      if (matches.length > 1) {
        return json(req, 400, { error: "A selected job has multiple active screening links. Keep exactly one active link before sending." });
      }
    }
  }

  let sent = 0;
  let failed = 0;
  let skippedInvalidEmail = 0;

  for (const recipientInput of recipients) {
    const app = recipientInput.application_id ? applicationsById.get(recipientInput.application_id) : null;
    const relatedCandidate = app ? firstRelated(app.candidates) : null;
    const relatedJob = app ? firstRelated(app.jobs) : null;
    const candidate = relatedCandidate ?? (recipientInput.candidate_id ? candidatesById.get(recipientInput.candidate_id) : null);
    const candidateId = app?.candidate_id ?? candidate?.id ?? recipientInput.candidate_id ?? null;
    const recipient = normalizeText(candidate?.email, 320).toLowerCase();

    if (!candidate || !isValidEmail(recipient)) {
      skippedInvalidEmail += 1;
      continue;
    }

    const variables = {
      candidate_name: normalizeText(candidate.name || "there", 120),
      company_name: normalizeText(companyResult.data.name || "the company", 120),
      job_title: normalizeText(relatedJob?.title || "the role", 160),
      form_link: formLink,
      screening_link: app?.job_id
        ? `${origin}/screen/${(screeningJobsByJobId.get(app.job_id) ?? [])[0]?.unique_link_id ?? ""}`
        : "",
    };

    const subject = normalizeSubject(render(subjectTemplate, variables));
    const result = await sendRenderedEmail(admin, {
      templateKey: clientTemplate.key,
      templateName: clientTemplate.name,
      recipient,
      subject,
      html: render(htmlTemplate, variables, true),
      variables,
      company: companyResult.data as CompanyEmailSettings,
      companyId: auth.profile.companyId,
      candidateId,
      applicationId: app?.id ?? null,
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  return json(req, 200, {
    ok: true,
    rejected: rejectApplications ? applicationIds.length : 0,
    sent,
    failed,
    skipped_invalid_email: skippedInvalidEmail,
  });
}

async function sendCandidateRejected(req: Request, admin: SupabaseAdmin, body: Record<string, unknown>) {
  const allowedKeys = new Set(["mode", "application_ids", "subject", "html_body", "text_body"]);
  const unsupported = Object.keys(body ?? {}).filter((key) => !allowedKeys.has(key));
  if (unsupported.length > 0) return json(req, 400, { error: "Unsupported fields for rejection email" });

  const auth = await requireAuthenticatedProfile(req, admin);
  if (!auth.ok) return auth.response;

  const applicationIds = normalizeApplicationIds(body?.application_ids);
  const subjectTemplate = normalizeSubject(String(body?.subject ?? ""));
  const htmlTemplate = normalizeBody(body?.html_body);

  if (applicationIds.length === 0) return json(req, 400, { error: "application_ids is required" });
  if (!subjectTemplate) return json(req, 400, { error: "subject is required" });
  if (!htmlTemplate) return json(req, 400, { error: "html_body is required" });

  const { data: applications, error: appsError } = await admin
    .from("applications")
    .select("id, company_id, candidate_id, job_id, candidates(name, email), jobs(title)")
    .in("id", applicationIds);

  if (appsError) return json(req, 500, { error: "Could not load applications" });
  if (!applications || applications.length === 0) return json(req, 404, { error: "Applications not found" });
  if (applications.length !== applicationIds.length) return json(req, 404, { error: "One or more applications were not found" });
  const applicationRows = applications as CandidateEmailApplicationRow[];
  if (applicationRows.some((app) => app.company_id !== auth.profile.companyId)) {
    return json(req, 403, { error: "Applications must belong to your company" });
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name, email_domain, email_domain_status, email_from_name, email_reply_to")
    .eq("id", auth.profile.companyId)
    .maybeSingle();

  if (companyError || !company) return json(req, 404, { error: "Company email context not found" });

  const { error: updateError } = await admin
    .from("applications")
    .update({ stage: "rejected" })
    .in("id", applicationIds)
    .eq("company_id", auth.profile.companyId);

  if (updateError) return json(req, 500, { error: "Could not reject candidates" });

  const appsById = new Map(applicationRows.map((app) => [app.id, app]));
  let sent = 0;
  let failed = 0;
  let skippedInvalidEmail = 0;

  for (const applicationId of applicationIds) {
    const app = appsById.get(applicationId);
    const candidate = firstRelated(app?.candidates);
    const job = firstRelated(app?.jobs);
    const recipient = normalizeText(candidate?.email, 320).toLowerCase();

    if (!isValidEmail(recipient)) {
      skippedInvalidEmail += 1;
      continue;
    }

    const variables = {
      candidate_name: normalizeText(candidate?.name || "there", 120),
      company_name: normalizeText(company.name || "the company", 120),
      job_title: normalizeText(job?.title || "the role", 160),
    };

    const result = await sendRenderedEmail(admin, {
      templateKey: "candidate_rejected",
      templateName: "Candidate Rejected",
      recipient,
      subject: normalizeSubject(render(subjectTemplate, variables)),
      html: render(htmlTemplate, variables, true),
      variables,
      company: company as CompanyEmailSettings,
      companyId: auth.profile.companyId,
      candidateId: app?.candidate_id ?? null,
      applicationId,
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  return json(req, 200, {
    ok: true,
    rejected: applicationIds.length,
    sent,
    failed,
    skipped_invalid_email: skippedInvalidEmail,
  });
}

async function sendTestEmail(req: Request, admin: SupabaseAdmin, body: Record<string, unknown>) {
  const auth = await requireSuperAdmin(req, admin);
  if (!auth.ok) return auth.response;

  const templateKey = normalizeText(body?.template_key, 120);
  const recipient = normalizeText(body?.to, 320).toLowerCase();
  if (!templateKey || !recipient) return json(req, 400, { error: "template_key and to are required" });
  if (!isValidEmail(recipient)) return json(req, 400, { error: "Recipient email is invalid" });

  return sendEmail(req, admin, {
    templateKey,
    recipient,
    variables: normalizeVariables(body?.variables),
    company: null,
    test: true,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req)) return new Response("Forbidden", { status: 403, headers: { Vary: "Origin" } });
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (!isOriginAllowed(req)) return json(req, 403, { error: "Origin not allowed" });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const mode = normalizeText(body?.mode, 80);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (mode === "application_received") return await sendApplicationReceived(req, admin, body);
    if (mode === "candidate_email") return await sendCandidateEmail(req, admin, body);
    if (mode === "candidate_rejected") return await sendCandidateRejected(req, admin, body);
    if (mode === "test") return await sendTestEmail(req, admin, body);

    return json(req, 400, { error: "Unsupported email mode" });
  } catch (e: unknown) {
    return json(req, 500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
