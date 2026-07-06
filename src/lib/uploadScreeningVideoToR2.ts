import { uploadFileToR2 } from "@/lib/r2Worker";

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

export async function uploadScreeningVideoToR2({
  file,
  companyId,
  jobId,
  candidateEmail,
}: UploadScreeningVideoParams): Promise<UploadScreeningVideoResult> {
  return uploadFileToR2({
    file,
    folder: "videos",
    companyId,
    jobId,
    candidateId: candidateEmail.trim().toLowerCase(),
    fallbackContentType: "video/webm",
  });
}
