import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadToStorage } from ".";

const bucketByFolder = {
  resumes: "silverweb-ats-resumes",
  videos: "silverweb-ats-videos",
  documents: "silverweb-additional-documents",
} as const;

type PresignPayload = {
  folder: keyof typeof bucketByFolder;
  filename: string;
  contentType: string;
  candidateId: string;
  jobId?: string;
  fieldId?: string;
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

describe("storage upload routing", () => {
  it("routes resume uploads to the resume folder and defaults the job id", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadToStorage({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      category: "resume",
      companyId: "company",
      candidateId: "candidate",
    });

    expect(presignPayloads[0]).toMatchObject({
      folder: "resumes",
      jobId: "candidate-upload",
      candidateId: "candidate",
    });
    expect(result).toMatchObject({
      bucket: "silverweb-ats-resumes",
      filename: "resume.pdf",
      contentType: "application/pdf",
      size: 6,
    });
    expect("fileName" in result).toBe(false);
    expect("fileType" in result).toBe(false);
    expect("fileSize" in result).toBe(false);
  });

  it("routes screening videos to the videos folder and normalizes the candidate email", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadToStorage({
      file: new File(["video"], "screening.webm", { type: "video/webm" }),
      category: "video",
      companyId: "company",
      jobId: "job",
      candidateId: " Candidate@Example.COM ",
    });

    expect(presignPayloads[0]).toMatchObject({
      folder: "videos",
      jobId: "job",
      candidateId: "candidate@example.com",
    });
    expect(result.bucket).toBe("silverweb-ats-videos");
  });

  it("uses the video fallback content type when a recording file has no type", async () => {
    const { presignPayloads } = installUploadFetchMock();

    await uploadToStorage({
      file: new File(["video"], "screening.webm"),
      category: "video",
      companyId: "company",
      jobId: "job",
      candidateId: "candidate@example.com",
    });

    expect(presignPayloads[0].contentType).toBe("video/webm");
  });

  it("routes candidate additional documents to the documents folder", async () => {
    const { presignPayloads } = installUploadFetchMock();

    const result = await uploadToStorage({
      file: new File(["doc"], "certificate.pdf", { type: "application/pdf" }),
      category: "document",
      companyId: "company",
      candidateId: "candidate",
      jobId: "job",
    });

    expect(presignPayloads[0]).toMatchObject({
      folder: "documents",
      jobId: "job",
      candidateId: "candidate",
    });
    expect(result.bucket).toBe("silverweb-additional-documents");
  });

  it("routes lead form file uploads to the documents folder with form metadata", async () => {
    const { presignPayloads } = installUploadFetchMock();
    const submissionId = "submission";

    const result = await uploadToStorage({
      file: new File(["image"], "trn.jpg", { type: "image/jpeg" }),
      category: "document",
      companyId: "company",
      candidateId: `lead-form-${submissionId}`,
      jobId: "form",
      fieldId: "trn",
    });

    expect(presignPayloads[0]).toMatchObject({
      folder: "documents",
      jobId: "form",
      fieldId: "trn",
      candidateId: "lead-form-submission",
    });
    expect(result.bucket).toBe("silverweb-additional-documents");
  });

  it("sends an Authorization header when an access token is provided", async () => {
    const { fetchMock } = installUploadFetchMock();

    await uploadToStorage({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      category: "resume",
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
