export type UploadCategory = "resume" | "video";

export interface RequestUploadUrlParams {
  file: File;
  companyId: string;
  jobId: string;
  candidateId: string;
  category: UploadCategory;
  backendBaseUrl: string;
}

export interface RequestUploadUrlResponse {
  success: boolean;
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
  error?: string;
}

export interface UploadToR2Result {
  key: string;
  bucket: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export async function requestUploadUrl({
  file,
  companyId,
  jobId,
  candidateId,
  category,
  backendBaseUrl,
}: RequestUploadUrlParams): Promise<RequestUploadUrlResponse> {
  const response = await fetch(`${backendBaseUrl}/api/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      companyId,
      jobId,
      candidateId,
      category,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to request upload URL");
  }

  return data;
}

export async function uploadFileDirectToR2(
  signedUrl: string,
  file: File
): Promise<void> {
  const uploadResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file to storage");
  }
}

export async function uploadToR2({
  file,
  companyId,
  jobId,
  candidateId,
  category,
  backendBaseUrl,
}: RequestUploadUrlParams): Promise<UploadToR2Result> {
  const signedUrlData = await requestUploadUrl({
    file,
    companyId,
    jobId,
    candidateId,
    category,
    backendBaseUrl,
  });

  await uploadFileDirectToR2(signedUrlData.url, file);

  return {
    key: signedUrlData.key,
    bucket: signedUrlData.bucket,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  };
}
