import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadLeadFormFileToR2 } from "./uploadLeadFormFileToR2";
import { uploadResumeToR2 } from "./uploadResumeToR2";
import { uploadScreeningVideoToR2 } from "./uploadScreeningVideoToR2";
import { uploadToStorage } from "./uploadToStorage";

const bucketByFolder = {
  resumes: "silverweb-ats-resumes",
  videos: "silverweb-ats-videos",
  documents: "silverweb-additional-documents",
} as const;

type PresignPayload = {
  folder: keyof typeof bucketByFolder;
  filename: string;
};

function installUploadFetchMock() {
  const presignPayloads: PresignPayload[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/presign-upload")) {
      const payload = JSON.parse(String(init?.body)) as PresignPayload;
      presignPayloads.push(payload);
      const bucket = bucketByFolder[payload.folder];
      return new Response(
        JSON.stringify({
          uploadUrl: `https://example.r2.cloudflarestorage.com/${bucket}/signed`,
          key: `${payload.folder}/company/job/${payload.filename}`,
          bucket,
        }),
        { status: 200 },
      );
    }
    return new Response("", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, presignPayloads };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R2 app upload routing", () => {
  it("routes resume uploads to the resume folder", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadResumeToR2({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      companyId: "company",
      candidateId: "candidate",
    });

    expect(presignPayloads[0].folder).toBe("resumes");
    expect(result.bucket).toBe("silverweb-ats-resumes");
  });

  it("routes screening videos to the videos folder", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadScreeningVideoToR2({
      file: new File(["video"], "screening.webm", { type: "video/webm" }),
      companyId: "company",
      jobId: "job",
      candidateEmail: "candidate@example.com",
    });

    expect(presignPayloads[0].folder).toBe("videos");
    expect(result.bucket).toBe("silverweb-ats-videos");
  });

  it("routes candidate additional documents to the documents folder", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadToStorage({
      file: new File(["doc"], "certificate.pdf", { type: "application/pdf" }),
      companyId: "company",
      candidateId: "candidate",
      jobId: "job",
      category: "document",
    });

    expect(presignPayloads[0].folder).toBe("documents");
    expect(result.bucket).toBe("silverweb-additional-documents");
  });

  it("routes lead form file uploads to the documents folder", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadLeadFormFileToR2({
      file: new File(["image"], "trn.jpg", { type: "image/jpeg" }),
      companyId: "company",
      formId: "form",
      submissionId: "submission",
      fieldId: "trn",
    });

    expect(presignPayloads[0].folder).toBe("documents");
    expect(result.bucket).toBe("silverweb-additional-documents");
  });

  it("sends an Authorization header when an access token is provided", async () => {
    const { fetchMock } = installUploadFetchMock();

    await uploadResumeToR2({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      companyId: "company",
      candidateId: "candidate",
      accessToken: "session-token",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/presign-upload"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
        }),
      }),
    );
  });
});
