import { createClient } from "npm:@supabase/supabase-js@2";
import { createReportHandler, type ErrorReportInsert, type ErrorReportStore } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HASH_SECRET = Deno.env.get("ERROR_REPORT_HASH_SECRET") ?? "";
const SUPPORT_EMAIL = (Deno.env.get("SUPPORT_ALERT_EMAIL") ?? "support@rizonhire.com").trim();
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_API_URL = Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.rizonhire.com",
  "https://test.rizonhire.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const store: ErrorReportStore = {
  async insertWithinRateLimit(report: ErrorReportInsert, since, limit) {
    const { data, error } = await admin
      .rpc("accept_operational_error_report", {
        _occurred_at: report.occurredAt,
        _company_id: report.companyId,
        _user_id: report.userId,
        _actor_hash: report.actorHash,
        _source: report.source,
        _method: report.method,
        _http_status: report.status,
        _service_path: report.servicePath,
        _error_code: report.code,
        _error_message: report.message,
        _page_path: report.pagePath,
        _stack: report.stack,
        _since: since,
        _limit: limit,
      })
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, receivedAt: data.received_at };
  },

  async markEmailSent(reportId) {
    const { error } = await admin
      .from("operational_error_reports")
      .update({ email_status: "sent", emailed_at: new Date().toISOString(), email_error: null })
      .eq("id", reportId);
    if (error) throw error;
  },

  async markEmailFailed(reportId, message) {
    const { error } = await admin
      .from("operational_error_reports")
      .update({ email_status: "failed", email_error: message.slice(0, 500) })
      .eq("id", reportId);
    if (error) console.error("Could not record support email failure", { reportId, error });
  },
};

function anonymousActorKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) || "unknown";
  return `anon:${ip}:${userAgent}`;
}

async function identify(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser();
    if (!error && data.user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("company_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      return {
        authenticated: true,
        userId: data.user.id,
        companyId: profile?.company_id ?? null,
        actorKey: `user:${data.user.id}`,
      };
    }
  }

  return {
    authenticated: false,
    userId: null,
    companyId: null,
    actorKey: anonymousActorKey(request),
  };
}

const handler = createReportHandler({
  allowedOrigins: ALLOWED_ORIGINS,
  hashSecret: HASH_SECRET,
  supportEmail: SUPPORT_EMAIL,
  resendApiKey: RESEND_API_KEY,
  resendApiUrl: RESEND_API_URL,
  identify,
  store,
  fetcher: fetch,
});

Deno.serve(handler);
