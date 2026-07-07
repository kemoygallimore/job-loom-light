import { describe, expect, it } from "vitest";
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
  INVOICE_BUCKET: {} as R2Bucket,
  BROWSER: {},
} satisfies Env;

async function presign(folder: string) {
  const response = await worker.fetch(
    new Request("https://api.rizonhire.com/presign-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://test.rizonhire.com",
      },
      body: JSON.stringify({
        filename: "sample.pdf",
        contentType: "application/pdf",
        folder,
        companyId: "company-1",
        jobId: "job-1",
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

describe("R2 API Worker bucket routing", () => {
  it("routes resume uploads to the resume bucket", async () => {
    const { response, body } = await presign("resumes");

    expect(response.status).toBe(200);
    expect(body.bucket).toBe("silverweb-ats-resumes");
    expect(body.key).toMatch(/^resumes\/company-1\/job-1\//);
    expect(body.uploadUrl).toContain("silverweb-ats-resumes");
  });

  it("routes video uploads to the video bucket", async () => {
    const { response, body } = await presign("videos");

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

  it("rejects unknown upload folders", async () => {
    const { response, body } = await presign("misc");

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid upload folder");
  });

  it("allows signed view links for the additional documents bucket", async () => {
    const response = await worker.fetch(
      new Request("https://api.rizonhire.com/sign-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
});
