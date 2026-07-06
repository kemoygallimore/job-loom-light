import { R2UploadFolder, uploadFileToR2 } from "@/lib/r2Worker";

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

function getFolder(category: UploadCategory): R2UploadFolder {
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
  const result = await uploadFileToR2({
    file,
    folder,
    companyId,
    candidateId,
    jobId,
  });

  return {
    bucket: result.bucket,
    key: result.key,
    fileName: file.name,
    fileType: result.contentType,
    fileSize: file.size,
  };
}
