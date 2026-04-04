import { supabase } from "@/integrations/supabase/client";

export type UploadCategory = "resume" | "video";
export type BucketName = "resumes" | "screening-videos";

export interface UploadToStorageParams {
  file: File;
  companyId: string;
  jobId: string;
  candidateId: string;
  category: UploadCategory;
}

export interface UploadToStorageResult {
  path: string;
  bucket: BucketName;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function getBucket(category: UploadCategory): BucketName {
  return category === "video" ? "screening-videos" : "resumes";
}

export async function uploadToStorage({
  file,
  companyId,
  jobId,
  candidateId,
  category,
}: UploadToStorageParams): Promise<UploadToStorageResult> {
  const bucket = getBucket(category);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${companyId}/${jobId}/${candidateId}/${timestamp}-${safeName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return {
    path,
    bucket,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}
