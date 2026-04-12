export interface UploadScreeningVideoParams {
  file: File;
  companyId: string;
  jobId: string;
  candidateEmail: string;
}

export interface UploadScreeningVideoResult {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

const WORKER_URL = "https://api.rizonhire.com/presign-upload";

export async function uploadScreeningVideoToR2({
  file,
  companyId,
  jobId,
  candidateEmail,
}: UploadScreeningVideoParams): Promise<UploadScreeningVideoResult> {
  const presignRes = await fetch(`${WORKER_URL}/presign-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "video/webm",
      folder: "videos",
      companyId,
      jobId,
      candidateId: candidateEmail.trim().toLowerCase(),
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
    headers: {
      "Content-Type": file.type || "video/webm",
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Failed to upload video: ${errorText}`);
  }

  return {
    bucket,
    key,
    filename: file.name,
    contentType: file.type || "video/webm",
    size: file.size,
  };
}
