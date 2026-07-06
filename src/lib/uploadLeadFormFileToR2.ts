const WORKER_URL = "https://api.rizonhire.com";

export interface UploadLeadFormFileParams {
  file: File;
  companyId: string;
  formId: string;
  submissionId: string;
  fieldId: string;
}

export interface UploadLeadFormFileResult {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

export async function uploadLeadFormFileToR2({
  file,
  companyId,
  formId,
  submissionId,
  fieldId,
}: UploadLeadFormFileParams): Promise<UploadLeadFormFileResult> {
  const presignRes = await fetch(`${WORKER_URL}/presign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder: "documents",
      companyId,
      candidateId: `lead-form-${submissionId}`,
      jobId: formId,
      fieldId,
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
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}
