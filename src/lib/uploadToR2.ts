export type UploadCategory = "resume" | "video";
export type BucketType = "resumes" | "videos";

export interface RequestUploadUrlParams {
  file: File;
  companyId: string;
  jobId: string;
  candidateId: string;
  category: UploadCategory;
  backendBaseUrl: string;
}

export interface RequestUploadUrlResponse {
  uploadUrl: string;
  key: string;
  bucket: string;
  bucketType: BucketType;
  error?: string;
}

export interface UploadToR2Result {
  key: string;
  bucket: string;
  bucketType: BucketType;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function mapCategoryToBucketType(category: UploadCategory): BucketType {
  return category === "video" ? "videos" : "resumes";
}

export async function requestUploadUrl({
  file,
  companyId,
  jobId,
  candidateId,
  category,
  backendBaseUrl,
}: RequestUploadUrlParams): Promise<RequestUploadUrlResponse> {
  const bucketType = mapCategoryToBucketType(category);

  const response = await fetch(`${backendBaseUrl}/api/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      companyId,
      jobId,
      candidateId,
      bucketType,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to request upload URL");
  }

  return data;
}

export async function uploadFileDirectToR2(signedUrl: string, file: File): Promise<void> {
  const uploadResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(errorText || "Failed to upload file to storage");
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

  await uploadFileDirectToR2(signedUrlData.uploadUrl, file);

  return {
    key: signedUrlData.key,
    bucket: signedUrlData.bucket,
    bucketType: signedUrlData.bucketType,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}
