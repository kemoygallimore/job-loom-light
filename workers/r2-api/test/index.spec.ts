import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { Env } from "../src/index";

const testEnv = {
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_ACCOUNT_ID: "test-account",
  R2_BUCKET_RESUMES: "silverweb-ats-resumes",
  R2_BUCKET_VIDEOS: "silverweb-ats-videos",
  R2_BUCKET_ADDITIONAL_DOCUMENTS: "silverweb-additional-documents",
  RESEND_API_KEY: "test-resend-key",
  R2_WORKER_SECRET: "test-worker-secret",
  ALLOWED_ORIGINS: "https://test.rizonhire.com,http://localhost:8080",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  INVOICE_BUCKET: {} as R2Bucket,
  BROWSER: {},
} satisfies Env;

function installFetchMock() {
  const resendPayloads: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const parsedUrl = new URL(url);

    if (url === "https://api.resend.com/emails") {
      resendPayloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
    }

    if (parsedUrl.hostname.endsWith(".supabase.co") && parsedUrl.pathname === "/auth/v1/user") {
      const auth = init?.headers instanceof Headers
        ? init.headers.get("Authorization")
        : (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === "Bearer valid-company-a-token") {
        return new Response(JSON.stringify({ id: "user-a" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
    }

    if (parsedUrl.hostname.endsWith(".supabase.co") && parsedUrl.pathname === "/rest/v1/profiles") {
      if (parsedUrl.searchParams.get("user_id") === "eq.user-a") {
        return new Response(JSON.stringify([{ company_id: "company-a" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }

    if (parsedUrl.hostname.endsWith(".supabase.co") && parsedUrl.pathname === "/rest/v1/jobs") {
      const isOpenJob =
        parsedUrl.searchParams.get("id") === "eq.job-1" &&
        parsedUrl.searchParams.get("company_id") === "eq.company-1" &&
        parsedUrl.searchParams.get("status") === "eq.open";
      return new Response(JSON.stringify(isOpenJob ? [{ id: "job-1" }] : []), { status: 200 });
    }

    if (parsedUrl.hostname.endsWith(".supabase.co") && parsedUrl.pathname === "/rest/v1/lead_forms") {
      const isActiveForm =
        parsedUrl.searchParams.get("id") === "eq.form-1" &&
        parsedUrl.searchParams.get("company_id") === "eq.company-1" &&
        parsedUrl.searchParams.get("status") === "eq.active" &&
        parsedUrl.searchParams.get("deleted_at") === "is.null";
      return new Response(JSON.stringify(isActiveForm ? [{ id: "form-1" }] : []), { status: 200 });
    }

    return new Response("", { status: 200 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, resendPayloads };
}

async function presign(folder: string, contentType = "application/pdf", jobId = "job-1") {
  installFetchMock();

  const response = await worker.fetch(
    new Request("https://api.rizonhire.com/presign-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://test.rizonhire.com",
      },
      body: JSON.stringify({
        filename: "sample.pdf",
        contentType,
        folder,
        companyId: "company-1",
        jobId,
        candidateId: "candidate-1",
      }),
    }),
    testEnv,
  );

  return {
    response,
    body: await response.json<Record<string, string>>(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R2 API Worker bucket routing", () => {
  it("routes resume uploads to the resume bucket", async () => {
    const { response, body } = await presign("resumes");

    expect(response.status).toBe(200);
    expect(body.bucket).toBe("silverweb-ats-resumes");
    expect(body.key).toMatch(/^resumes\/company-1\/job-1\//);
    expect(body.uploadUrl).toContain("silverweb-ats-resumes");
  });

  it("routes video uploads to the video bucket", async () => {
    const { response, body } = await presign("videos", "video/webm");

    expect(response.status).toBe(200);
    expect(body.bucket).toBe("silverweb-ats-videos");
    expect(body.key).toMatch(/^videos\/company-1\/job-1\//);
    expect(body.uploadUrl).toContain("silverweb-ats-videos");
  });

  it("routes document uploads to the additional documents bucket", async () => {
    const { response, body } = await presign("documents");

    expect(response.status).toBe(200);
    expect(body.bucket).toBe("silverweb-additional-documents");
    expect(body.key).toMatch(/^documents\/company-1\/job-1\//);
    expect(body.uploadUrl).toContain("silverweb-additional-documents");
  });

  it("routes public lead form file uploads through the documents bucket", async () => {
    const { response, body } = await presign("documents", "image/jpeg", "form-1");

    expect(response.status).toBe(200);
    expect(body.bucket).toBe("silverweb-additional-documents");
    expect(body.key).toMatch(/^documents\/company-1\/form-1\//);
  });

  it("rejects unknown upload folders", async () => {
    const { response, body } = await presign("misc");

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid upload folder");
  });

  it("allows signed view links for the additional documents bucket with the worker secret", async () => {
    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/sign-view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-worker-secret",
        },
        body: JSON.stringify({
          bucket: "silverweb-additional-documents",
          key: "documents/company-1/job-1/sample.pdf",
        }),
      }),
      testEnv,
    );
    const body = await response.json<Record<string, string>>();

    expect(response.status).toBe(200);
    expect(body.viewUrl).toContain("silverweb-additional-documents");
  });

  it("rejects delete-object without an Authorization header", async () => {
    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/delete-object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "silverweb-ats-videos",
          key: "videos/company-1/job-1/sample.webm",
        }),
      }),
      testEnv,
    );
    const body = await response.json<Record<string, string>>();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects sign-view without a valid token", async () => {
    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/sign-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "silverweb-ats-videos",
          key: "videos/company-1/job-1/sample.webm",
        }),
      }),
      testEnv,
    );
    const body = await response.json<Record<string, string>>();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects sign-view when a company A token requests a company B key", async () => {
    installFetchMock();

    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/sign-view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-company-a-token",
        },
        body: JSON.stringify({
          bucket: "silverweb-ats-videos",
          key: "videos/company-b/job-1/sample.webm",
        }),
      }),
      testEnv,
    );
    const body = await response.json<Record<string, string>>();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("escapes script tags in send-lead-email messages", async () => {
    const { resendPayloads } = installFetchMock();

    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/send-lead-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://test.rizonhire.com",
        },
        body: JSON.stringify({
          name: "Test Lead",
          email: "lead@example.com",
          company: "Example Co",
          phone: "555-0100",
          message: "Hello <script>alert('xss')</script>",
        }),
      }),
      testEnv,
    );

    expect(response.status).toBe(200);
    expect(String(resendPayloads[0].html)).not.toContain("<script>");
    expect(String(resendPayloads[0].html)).toContain("&lt;script&gt;");
  });
});
