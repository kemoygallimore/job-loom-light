import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reportOperationalError } = vi.hoisted(() => ({
  reportOperationalError: vi.fn(),
}));

vi.mock("@/lib/operationalErrorReporting", () => ({
  reportOperationalError,
}));

import { getSignedR2Url, uploadFileToR2 } from "./r2Client";

describe("R2 operational reporting", () => {
  beforeEach(() => {
    reportOperationalError.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a failed worker response without request content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("candidate data", { status: 503 })));

    await expect(getSignedR2Url("private-bucket", "candidate/resume.pdf", "session-token"))
      .rejects.toThrow("Failed to get signed file URL");

    expect(reportOperationalError).toHaveBeenCalledOnce();
    expect(reportOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "r2",
        method: "POST",
        status: 503,
        servicePath: "/sign-view",
      }),
      "Bearer session-token",
    );
    expect(JSON.stringify(reportOperationalError.mock.calls[0])).not.toContain("candidate data");
    expect(JSON.stringify(reportOperationalError.mock.calls[0])).not.toContain("resume.pdf");
  });

  it("reports a direct-upload network error once and preserves the safe UI error", async () => {
    const networkError = new TypeError("connection reset");
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          uploadUrl: "https://example.r2.cloudflarestorage.com/private/signed?token=secret",
          key: "resumes/company/candidate/resume.pdf",
          bucket: "private",
        }), { status: 200, headers: { "content-type": "application/json" } }))
        .mockRejectedValueOnce(networkError),
    );

    await expect(uploadFileToR2({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      folder: "resumes",
      companyId: "company",
      candidateId: "candidate",
      accessToken: "session-token",
    })).rejects.toThrow("The file could not be uploaded to storage");

    expect(reportOperationalError).toHaveBeenCalledOnce();
    expect(reportOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "r2",
        method: "PUT",
        servicePath: "/direct-upload",
        message: "R2 network request failed",
      }),
      "Bearer session-token",
    );
  });
});
