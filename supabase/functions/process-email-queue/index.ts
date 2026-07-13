import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

interface EmailTemplate {
  id?: string;
  key?: string;
  name?: string;
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

type EmailSendResult =
  | { ok: true; status: number; id?: unknown; duplicate?: boolean; warning?: string }
  | { ok: false; status: number; error: string; details?: unknown; retryable?: boolean };

interface QueueMessage {
  msg_id: number | string;
  read_ct: number | string;
  message: {
    mode?: unknown;
    application_id?: unknown;
  } | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RIZONHIRE_FROM_EMAIL") ?? "RizonHire <no-reply@rizonhire.com>";
const QUEUE_NAME = "application_emails";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 180;
const DEFAULT_SPACING_MS = 600;
const DEFAULT_MAX_RUNTIME_MS = 140_000;

function numberFromEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(Deno.env.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorize(req: Request) {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return json({ error: "CRON_SECRET not configured" }, 500);
  if (req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMessageId(value: number | string) {
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) throw new Error(`Invalid queue message id: ${value}`);
  return id;
}

function normalizeText(value: unknown, maxLength = 2000) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
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

function render(template: string, vars: Record<string, string>, escapeValues = false) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key] ?? "";
    return escapeValues ? escapeHtml(value) : value;
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function fail(status: number, error: string, details?: unknown, retryable = true): EmailSendResult {
  return { ok: false, status, error, details, retryable };
}

async function getTemplate(admin: SupabaseAdmin, templateKey: string) {
  const { data: tpl, error: tplErr } = await admin
    .rpc("resolve_email_template", {
      _company_id: null,
      _template_id: null,
      _template_key: templateKey,
      _purpose: "general",
      _include_inactive: false,
    })
    .maybeSingle();

  if (tplErr || !tpl) return fail(404, "Template not found", tplErr?.message);
  const template = tpl as EmailTemplate;
  if (!template.is_active || template.archived_at) return fail(400, "Template is disabled");
  return { ok: true as const, template };
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

async function sendTemplateEmail(
  admin: SupabaseAdmin,
  args: {
    templateKey: string;
    recipient: string;
    variables: Record<string, string>;
    company: CompanyEmailSettings | null;
    companyId?: string | null;
    candidateId?: string | null;
    applicationId?: string | null;
  },
): Promise<EmailSendResult> {
  if (!RESEND_API_KEY) return fail(500, "RESEND_API_KEY not configured");

  const templateResult = await getTemplate(admin, args.templateKey);
  if (!templateResult.ok) return templateResult;
  const tpl = templateResult.template;

  const { fromAddress, replyTo } = resolveSender(args.company);
  const subject = normalizeSubject(render(tpl.subject, args.variables));
  const html = render(tpl.html_body, args.variables, true);
  const text = tpl.text_body ? render(tpl.text_body, args.variables) : undefined;

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
    const { error: logError } = await admin.from("email_send_log").insert({
      ...logRow,
      status: "failed",
      error_message: JSON.stringify(resendData).slice(0, 1000),
    });
    if (logError) console.error("email_send_log failed insert failed:", logError);
    return fail(502, "Resend failed", resendData);
  }

  const { error: logError } = await admin.from("email_send_log").insert({
    ...logRow,
    status: "sent",
    provider_message_id: resendData?.id ?? null,
  });

  if (logError) {
    console.error("email_send_log sent insert failed:", logError);
    return { ok: true, status: 200, id: resendData?.id, warning: "Email sent, but send log insert failed" };
  }

  return { ok: true, status: 200, id: resendData?.id };
}

async function sendApplicationReceived(admin: SupabaseAdmin, applicationId: string): Promise<EmailSendResult> {
  const normalizedApplicationId = normalizeText(applicationId, 80);
  if (!normalizedApplicationId) return fail(400, "application_id is required", undefined, false);

  const { data: app, error: appError } = await admin
    .from("applications")
    .select("id, company_id, job_id, candidate_id")
    .eq("id", normalizedApplicationId)
    .maybeSingle();
  if (appError || !app) return fail(404, "Application not found", appError?.message);

  const { data: duplicate, error: duplicateError } = await admin
    .from("email_send_log")
    .select("id")
    .eq("template_key", "application_received")
    .eq("application_id", app.id)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (duplicateError) return fail(500, "Could not verify email send status", duplicateError.message);
  if (duplicate) return { ok: true, status: 200, duplicate: true };

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
    return fail(404, "Application email context not found", {
      candidate: candidateRes.error?.message,
      job: jobRes.error?.message,
      company: companyRes.error?.message,
    });
  }

  const recipient = normalizeText(candidateRes.data.email, 320).toLowerCase();
  if (!isValidEmail(recipient)) return fail(400, "Candidate email is invalid", undefined, false);

  return sendTemplateEmail(admin, {
    templateKey: "application_received",
    recipient,
    variables: {
      candidate_name: normalizeText(candidateRes.data.name, 120),
      company_name: normalizeText(companyRes.data.name, 120),
      job_title: normalizeText(jobRes.data.title, 160),
    },
    company: companyRes.data as CompanyEmailSettings,
    companyId: app.company_id,
    candidateId: app.candidate_id,
    applicationId: app.id,
  });
}

async function readMessages(admin: SupabaseAdmin, visibilityTimeoutSeconds: number, batchSize: number) {
  const { data, error } = await admin.rpc("read_application_email_queue", {
    p_visibility_timeout: visibilityTimeoutSeconds,
    p_batch_size: batchSize,
  });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  return (data ?? []) as QueueMessage[];
}

async function deleteMessage(admin: SupabaseAdmin, msgId: string) {
  const { error } = await admin.rpc("delete_application_email_queue_message", { p_msg_id: msgId });
  if (error) throw new Error(`Queue delete failed for ${msgId}: ${error.message}`);
}

async function archiveMessage(admin: SupabaseAdmin, msgId: string) {
  const { error } = await admin.rpc("archive_application_email_queue_message", { p_msg_id: msgId });
  if (error) throw new Error(`Queue archive failed for ${msgId}: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authError = authorize(req);
  if (authError) return authError;

  const batchSize = numberFromEnv("EMAIL_QUEUE_BATCH_SIZE", DEFAULT_BATCH_SIZE, 1, 100);
  const maxAttempts = numberFromEnv("EMAIL_QUEUE_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS, 1, 20);
  const visibilityTimeoutSeconds = numberFromEnv(
    "EMAIL_QUEUE_VISIBILITY_TIMEOUT_SECONDS",
    DEFAULT_VISIBILITY_TIMEOUT_SECONDS,
    30,
    600,
  );
  const spacingMs = numberFromEnv("EMAIL_QUEUE_SPACING_MS", DEFAULT_SPACING_MS, 0, 5_000);
  const maxRuntimeMs = numberFromEnv("EMAIL_QUEUE_MAX_RUNTIME_MS", DEFAULT_MAX_RUNTIME_MS, 5_000, 145_000);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = Date.now();
  const deadline = startedAt + maxRuntimeMs;
  const summary = {
    queue: QUEUE_NAME,
    read: 0,
    sent: 0,
    duplicates: 0,
    failed: 0,
    archived: 0,
    invalid: 0,
    delete_errors: 0,
    archive_errors: 0,
    stopped_for_time: false,
  };

  try {
    while (Date.now() + 5_000 < deadline) {
      const messages = await readMessages(admin, visibilityTimeoutSeconds, batchSize);
      if (messages.length === 0) break;

      for (const message of messages) {
        if (Date.now() + 5_000 >= deadline) {
          summary.stopped_for_time = true;
          break;
        }

        summary.read += 1;
        const msgId = safeMessageId(message.msg_id);
        const applicationId = normalizeText(message.message?.application_id, 80);
        const mode = normalizeText(message.message?.mode, 80);

        if (!applicationId || mode !== "application_received") {
          summary.invalid += 1;
          try {
            await archiveMessage(admin, msgId);
            summary.archived += 1;
          } catch (error) {
            summary.archive_errors += 1;
            console.error("Invalid queue message archive failed:", error);
          }
          continue;
        }

        const result = await sendApplicationReceived(admin, applicationId);

        if (result.ok) {
          try {
            await deleteMessage(admin, msgId);
            if (result.duplicate) summary.duplicates += 1;
            else summary.sent += 1;
          } catch (error) {
            summary.delete_errors += 1;
            console.error("Queue message delete failed after email success:", error);
          }
        } else {
          summary.failed += 1;
          const readCount = Number(message.read_ct ?? 0);
          console.error("Application email send failed:", {
            msg_id: msgId,
            application_id: applicationId,
            read_ct: readCount,
            error: result.error,
            details: result.details,
          });

          if (readCount >= maxAttempts) {
            try {
              await archiveMessage(admin, msgId);
              summary.archived += 1;
            } catch (error) {
              summary.archive_errors += 1;
              console.error("Queue message archive failed after max attempts:", error);
            }
          }
        }

        if (spacingMs > 0 && Date.now() + spacingMs + 5_000 < deadline) {
          await sleep(spacingMs);
        }
      }

      if (summary.stopped_for_time) break;
    }

    return json({
      success: true,
      ...summary,
      runtime_ms: Date.now() - startedAt,
      config: {
        batch_size: batchSize,
        max_attempts: maxAttempts,
        visibility_timeout_seconds: visibilityTimeoutSeconds,
        spacing_ms: spacingMs,
      },
    });
  } catch (error: unknown) {
    return json(
      {
        success: false,
        ...summary,
        error: error instanceof Error ? error.message : "Unknown error",
        runtime_ms: Date.now() - startedAt,
      },
      500,
    );
  }
});
