import {
  buildSupportEmail,
  hashActor,
  parseOperationalError,
  type OperationalErrorSource,
} from "./reporting.ts";

export interface ReportIdentity {
  authenticated: boolean;
  userId: string | null;
  companyId: string | null;
  actorKey: string;
}

export interface ErrorReportInsert {
  occurredAt: string;
  companyId: string | null;
  userId: string | null;
  actorHash: string;
  source: OperationalErrorSource;
  method: string | null;
  status: number | null;
  servicePath: string | null;
  code: string | null;
  message: string;
  pagePath: string;
  stack: string | null;
  emailStatus: "pending";
}

export interface ErrorReportStore {
  insertWithinRateLimit(
    report: ErrorReportInsert,
    since: string,
    limit: number,
  ): Promise<{ id: string; receivedAt: string } | null>;
  markEmailSent(reportId: string): Promise<void>;
  markEmailFailed(reportId: string, message: string): Promise<void>;
}

interface HandlerDependencies {
  allowedOrigins: string[];
  hashSecret: string;
  supportEmail: string;
  resendApiKey?: string;
  resendApiUrl: string;
  identify(request: Request): Promise<ReportIdentity>;
  store: ErrorReportStore;
  fetcher: typeof fetch;
  now?: () => Date;
}

function corsHeaders(origin: string | null, allowedOrigins: string[]) {
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(origin: string | null, allowedOrigins: string[], status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin, allowedOrigins), "Content-Type": "application/json" },
  });
}

function emailFailureMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown email failure").slice(0, 500);
}

export function createReportHandler(dependencies: HandlerDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return async (request: Request) => {
    const origin = request.headers.get("Origin");
    if (!origin || !dependencies.allowedOrigins.includes(origin)) {
      return json(origin, dependencies.allowedOrigins, 403, { error: "Forbidden origin" });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, dependencies.allowedOrigins) });
    }
    if (request.method !== "POST") {
      return json(origin, dependencies.allowedOrigins, 405, { error: "Method not allowed" });
    }

    let report;
    try {
      report = parseOperationalError(await request.json());
    } catch (error) {
      return json(origin, dependencies.allowedOrigins, 400, {
        error: error instanceof Error ? error.message : "Invalid report",
      });
    }

    try {
      const identity = await dependencies.identify(request);
      const actorHash = await hashActor(dependencies.hashSecret, identity.actorKey);
      const since = new Date(now().getTime() - 10 * 60 * 1000).toISOString();
      const limit = identity.authenticated ? 20 : 5;
      const stored = await dependencies.store.insertWithinRateLimit({
        occurredAt: report.occurredAt,
        companyId: identity.companyId,
        userId: identity.userId,
        actorHash,
        source: report.source,
        method: report.method ?? null,
        status: report.status ?? null,
        servicePath: report.servicePath ?? null,
        code: report.code ?? null,
        message: report.message,
        pagePath: report.pagePath,
        stack: report.stack ?? null,
        emailStatus: "pending",
      }, since, limit);
      if (!stored) return json(origin, dependencies.allowedOrigins, 429, { error: "Rate limit exceeded" });

      try {
        if (!dependencies.resendApiKey) throw new Error("RESEND_API_KEY is not configured");
        if (!dependencies.supportEmail) throw new Error("SUPPORT_ALERT_EMAIL is not configured");
        const email = buildSupportEmail({
          reportId: stored.id,
          receivedAt: stored.receivedAt,
          companyId: identity.companyId,
          userId: identity.userId,
          source: report.source,
          method: report.method ?? null,
          status: report.status ?? null,
          servicePath: report.servicePath ?? null,
          code: report.code ?? null,
          message: report.message,
          pagePath: report.pagePath,
          stack: report.stack ?? null,
        });
        const emailResponse = await dependencies.fetcher(dependencies.resendApiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dependencies.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "RizonHire Alerts <info@rizonhire.com>",
            to: [dependencies.supportEmail],
            subject: email.subject,
            html: email.html,
          }),
        });
        if (!emailResponse.ok) throw new Error(`Resend returned ${emailResponse.status}`);
        await dependencies.store.markEmailSent(stored.id);
      } catch (error) {
        await dependencies.store.markEmailFailed(stored.id, emailFailureMessage(error));
      }

      return json(origin, dependencies.allowedOrigins, 202, { report_id: stored.id });
    } catch (error) {
      console.error("Operational error report failed", error);
      return json(origin, dependencies.allowedOrigins, 500, { error: "Could not record report" });
    }
  };
}
