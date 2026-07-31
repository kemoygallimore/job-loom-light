import { describe, expect, it } from "vitest";
import {
  buildSupportEmail,
  hashActor,
  parseOperationalError,
} from "./reporting";

describe("parseOperationalError", () => {
  it("keeps only the allowlisted shape and redacts sensitive values", () => {
    const parsed = parseOperationalError({
      source: "supabase",
      occurredAt: "2026-07-31T20:00:00.000Z",
      method: "post",
      status: 400,
      servicePath: "https://example.supabase.co/rest/v1/interview_feedback?token=secret",
      code: "PGRST204",
      message: "User person@example.com failed for 123e4567-e89b-12d3-a456-426614174000 with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
      pagePath: "/candidates/123e4567-e89b-12d3-a456-426614174000?tab=feedback",
      stack: "Error: person@example.com\n    at submit (https://app.rizonhire.com/assets/app.js?candidate=person@example.com:10:2)",
    });

    expect(parsed).toEqual({
      source: "supabase",
      occurredAt: "2026-07-31T20:00:00.000Z",
      method: "POST",
      status: 400,
      servicePath: "/rest/v1/interview_feedback",
      code: "PGRST204",
      message: "Supabase request failed with status 400",
      pagePath: "/candidates/[redacted-id]",
      stack: "    at submit (https://app.rizonhire.com/assets/app.js?[redacted-query]",
    });
  });

  it("rejects unknown fields instead of silently accepting request content", () => {
    expect(() => parseOperationalError({
      source: "r2",
      occurredAt: "2026-07-31T20:00:00.000Z",
      message: "upload failed",
      pagePath: "/apply",
      requestBody: { candidate: "secret" },
    })).toThrow("Unknown report field: requestBody");
  });
});

describe("hashActor", () => {
  it("returns a stable HMAC without exposing the actor input", async () => {
    const first = await hashActor("a-secret-with-enough-entropy", "anon:203.0.113.1:browser");
    const second = await hashActor("a-secret-with-enough-entropy", "anon:203.0.113.1:browser");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("203.0.113.1");
  });
});

describe("buildSupportEmail", () => {
  it("escapes report content before placing it in HTML", () => {
    const email = buildSupportEmail({
      reportId: "report-1",
      receivedAt: "2026-07-31T20:00:00.000Z",
      companyId: null,
      userId: null,
      source: "browser_error",
      method: null,
      status: null,
      servicePath: null,
      code: null,
      message: "<script>alert(1)</script>",
      pagePath: "/dashboard",
      stack: null,
    });

    expect(email.subject).toContain("browser_error");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
