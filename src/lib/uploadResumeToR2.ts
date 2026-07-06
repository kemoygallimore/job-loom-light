import { uploadFileToR2 } from "@/lib/r2Worker";

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
  return uploadFileToR2({
    file,
    folder: "resumes",
    companyId,
    jobId: "candidate-upload",
    candidateId,
  });
}
