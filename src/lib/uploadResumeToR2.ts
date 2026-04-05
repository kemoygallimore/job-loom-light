const WORKER_URL = "https://silverweb-ats.solutionssilverweb.workers.dev";

export interface UploadResumeToR2Params {
  file: File;
  companyId: string;
  candidateId: string;
}

export interface UploadResumeToR2Result {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

export async function uploadResumeToR2({
  file,
  companyId,
  candidateId,
}: UploadResumeToR2Params): Promise<UploadResumeToR2Result> {
  const presignRes = await fetch(`${WORKER_URL}/presign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder: "resumes",
      companyId,
      jobId: "candidate-upload",
      candidateId,
    }),
  });

  if (!presignRes.ok) {
    const errorText = await presignRes.text();
    throw new Error(`Failed to get upload URL: ${errorText}`);
  }

  const { uploadUrl, key, bucket } = await presignRes.json();

  if (!uploadUrl || !key || !bucket) {
    throw new Error("Invalid Worker response");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Failed to upload resume: ${errorText}`);
  }

  return {
    bucket,
    key,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}
