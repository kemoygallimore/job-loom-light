const WORKER_URL = "https://api.rizonhire.com";

export type UploadCategory = "resume" | "video" | "document";

export interface UploadToStorageParams {
  file: File;
  companyId: string;
  jobId?: string;
  candidateId: string;
  category: UploadCategory;
}

export interface UploadToStorageResult {
  bucket: string;
  key: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function getFolder(category: UploadCategory): string {
  if (category === "video") return "videos";
  if (category === "document") return "documents";
  return "resumes";
}

export async function uploadToStorage({
  file,
  companyId,
  jobId,
  candidateId,
  category,
}: UploadToStorageParams): Promise<UploadToStorageResult> {
  const folder = getFolder(category);

  // The Cloudflare Worker requires a valid UUID for jobId. For ad-hoc
  // document uploads (not tied to a job), reuse the candidateId so the
  // request passes validation and the file is namespaced under the candidate.
  const effectiveJobId = jobId ?? (category === "document" ? candidateId : undefined);

  const presignRes = await fetch(`${WORKER_URL}/presign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
      companyId,
      candidateId,
      ...(effectiveJobId ? { jobId: effectiveJobId } : {}),
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
    throw new Error(`Failed to upload file: ${errorText}`);
  }

  return {
    bucket,
    key,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}
