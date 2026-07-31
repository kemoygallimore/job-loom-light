import { describe, expect, it, vi } from "vitest";
import {
  createInstrumentedFetch,
  installGlobalErrorReporting,
  type OperationalErrorPayload,
} from "./operationalErrorReporting";

describe("createInstrumentedFetch", () => {
  it("does not report successful requests", async () => {
    const send = vi.fn();
    const nativeFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const instrumented = createInstrumentedFetch(nativeFetch, send, () => "/dashboard");

    await instrumented("https://project.supabase.co/rest/v1/jobs?select=*");

    expect(send).not.toHaveBeenCalled();
  });

  it("reports a sanitized non-2xx response once without consuming its body", async () => {
    const send = vi.fn();
    const response = new Response(JSON.stringify({ code: "PGRST204", message: "Candidate Jane Doe feedback was private" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    const nativeFetch = vi.fn().mockResolvedValue(response);
    const instrumented = createInstrumentedFetch(nativeFetch, send, () => "/candidates/id?tab=feedback");

    const result = await instrumented("https://project.supabase.co/rest/v1/interview_feedback?columns=secret", {
      method: "POST",
      headers: { Authorization: "Bearer user-token" },
    });

    expect(await result.json()).toEqual({ code: "PGRST204", message: "Candidate Jane Doe feedback was private" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      source: "supabase",
      method: "POST",
      status: 400,
      servicePath: "/rest/v1/interview_feedback",
      code: "PGRST204",
      message: "Supabase request failed with status 400",
      pagePath: "/candidates/id",
    }), "Bearer user-token");
    expect(JSON.stringify(send.mock.calls[0])).not.toContain("Jane Doe");
  });

  it("reports network failures and rethrows the original error", async () => {
    const send = vi.fn();
    const failure = new TypeError("network unavailable");
    const nativeFetch = vi.fn().mockRejectedValue(failure);
    const instrumented = createInstrumentedFetch(nativeFetch, send, () => "/forms");

    await expect(instrumented("https://project.supabase.co/functions/v1/request-export")).rejects.toBe(failure);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      source: "supabase",
      message: "Supabase network request failed",
    }), undefined);
  });

  it("never reports failures from the reporting endpoint itself", async () => {
    const send = vi.fn();
    const nativeFetch = vi.fn().mockResolvedValue(new Response("down", { status: 500 }));
    const instrumented = createInstrumentedFetch(nativeFetch, send, () => "/dashboard");

    await instrumented("https://project.supabase.co/functions/v1/report-client-error", { method: "POST" });

    expect(send).not.toHaveBeenCalled();
  });
});

describe("installGlobalErrorReporting", () => {
  it("reports browser errors and unhandled rejections", () => {
    const reports: OperationalErrorPayload[] = [];
    const cleanup = installGlobalErrorReporting((payload) => reports.push(payload));

    window.dispatchEvent(new ErrorEvent("error", { message: "render failed", error: new Error("render failed") }));
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: new Error("promise failed") });
    window.dispatchEvent(rejection);
    cleanup();

    expect(reports.map((report) => report.source)).toEqual(["browser_error", "unhandled_rejection"]);
  });
});
