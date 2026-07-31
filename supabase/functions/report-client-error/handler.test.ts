import { describe, expect, it, vi } from "vitest";
import { createReportHandler, type ErrorReportStore } from "./handler";

function request(body: Record<string, unknown>, origin = "https://app.rizonhire.com") {
  return new Request("https://project.supabase.co/functions/v1/report-client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

const validBody = {
  source: "supabase",
  occurredAt: "2026-07-31T20:00:00.000Z",
  method: "POST",
  status: 400,
  servicePath: "/rest/v1/interview_feedback?secret=yes",
  code: "PGRST204",
  message: "Column missing",
  pagePath: "/candidates/id?tab=feedback",
};

function setup(
  overrides: Partial<ErrorReportStore> = {},
  identity = { authenticated: false, userId: null, companyId: null, actorKey: "anon:ip:ua" },
) {
  const store: ErrorReportStore = {
    insertWithinRateLimit: vi.fn().mockResolvedValue({ id: "report-1", receivedAt: "2026-07-31T20:00:01.000Z" }),
    markEmailSent: vi.fn().mockResolvedValue(undefined),
    markEmailFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
  const handler = createReportHandler({
    allowedOrigins: ["https://app.rizonhire.com"],
    hashSecret: "a-secret-with-enough-entropy",
    supportEmail: "support@rizonhire.com",
    resendApiKey: "resend-key",
    resendApiUrl: "https://api.resend.com/emails",
    identify: vi.fn().mockResolvedValue(identity),
    store,
    fetcher,
    now: () => new Date("2026-07-31T20:00:00.000Z"),
  });
  return { handler, store, fetcher };
}

describe("createReportHandler", () => {
  it("stores a sanitized report and emails support before returning accepted", async () => {
    const { handler, store, fetcher } = setup();
    const response = await handler(request(validBody));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ report_id: "report-1" });
    expect(store.insertWithinRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      servicePath: "/rest/v1/interview_feedback",
      pagePath: "/candidates/id",
      emailStatus: "pending",
    }), "2026-07-31T19:50:00.000Z", 5);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.markEmailSent).toHaveBeenCalledWith("report-1");
  });

  it("rejects disallowed browser origins", async () => {
    const { handler, store } = setup();
    const response = await handler(request(validBody, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(store.insertWithinRateLimit).not.toHaveBeenCalled();
  });

  it("limits anonymous actors to five accepted reports per ten minutes", async () => {
    const { handler, store, fetcher } = setup({ insertWithinRateLimit: vi.fn().mockResolvedValue(null) });
    const response = await handler(request(validBody));

    expect(response.status).toBe(429);
    expect(store.insertWithinRateLimit).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the twenty-report limit and resolved IDs for authenticated users", async () => {
    const { handler, store } = setup({}, {
      authenticated: true,
      userId: "user-1",
      companyId: "company-1",
      actorKey: "user:user-1",
    });
    const response = await handler(request(validBody));

    expect(response.status).toBe(202);
    expect(store.insertWithinRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", companyId: "company-1" }),
      "2026-07-31T19:50:00.000Z",
      20,
    );
  });

  it("records failed email delivery without failing the accepted report", async () => {
    const { handler, store, fetcher } = setup();
    fetcher.mockResolvedValueOnce(new Response("provider down", { status: 503 }));
    const response = await handler(request(validBody));

    expect(response.status).toBe(202);
    expect(store.markEmailFailed).toHaveBeenCalledWith("report-1", "Resend returned 503");
  });
});
