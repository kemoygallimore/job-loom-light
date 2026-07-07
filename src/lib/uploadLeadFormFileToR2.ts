import { uploadFileToR2 } from "@/lib/r2Worker";

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
  return uploadFileToR2({
    file,
    folder: "documents",
    companyId,
    candidateId: `lead-form-${submissionId}`,
    jobId: formId,
    fieldId,
  });
}
