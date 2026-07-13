import { supabase } from "@/integrations/supabase/client";
import {
  deleteR2Objects,
  getSignedR2Url,
  R2_BUCKET_RESUMES,
  R2_BUCKET_VIDEOS,
  uploadFileToR2,
  type R2UploadFolder,
  type UploadR2FileResult,
} from "./r2Client";

export {
  R2_BUCKET_ADDITIONAL_DOCUMENTS,
  R2_BUCKET_RESUMES,
  R2_BUCKET_VIDEOS,
  type R2UploadFolder,
  type UploadR2FileResult as StorageUploadResult,
} from "./r2Client";

export type UploadCategory = "resume" | "video" | "document";

export interface UploadToStorageParams {
  file: File;
  category: UploadCategory;
  companyId: string;
  candidateId: string;
  jobId?: string;
  fieldId?: string;
  accessToken?: string;
}

export interface DeleteVideoItem {
  bucket: string | null | undefined;
  key: string | null | undefined;
}

function getFolder(category: UploadCategory): R2UploadFolder {
  if (category === "video") return "videos";
  if (category === "document") return "documents";
  return "resumes";
}

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function uploadToStorage({
  file,
  category,
  companyId,
  candidateId,
  jobId,
  fieldId,
  accessToken,
}: UploadToStorageParams): Promise<UploadR2FileResult> {
  const isVideo = category === "video";

  return uploadFileToR2({
    file,
    folder: getFolder(category),
    companyId,
    candidateId: isVideo ? candidateId.trim().toLowerCase() : candidateId,
    jobId: category === "resume" ? jobId ?? "candidate-upload" : jobId,
    fieldId,
    fallbackContentType: isVideo ? "video/webm" : undefined,
    accessToken,
  });
}

export const getSignedViewUrl = getSignedR2Url;
export const deleteObjects = deleteR2Objects;

export async function getSignedVideoViewUrl(
  bucket: string | null | undefined,
  key: string | null | undefined,
  accessToken?: string,
): Promise<string> {
  const resolvedKey = key ?? "";
  const resolvedBucket = bucket ?? R2_BUCKET_VIDEOS;

  if (!resolvedKey) {
    throw new Error("No video key available");
  }

  return getSignedViewUrl(resolvedBucket, resolvedKey, accessToken);
}

export async function resolveFileUrl(
  fileUrlOrKey: string | null | undefined,
  bucket?: string | null,
  accessToken?: string,
): Promise<string | null> {
  if (!fileUrlOrKey) return null;

  if (isFullUrl(fileUrlOrKey)) {
    return fileUrlOrKey;
  }

  const resolvedBucket = bucket || R2_BUCKET_RESUMES;
  return getSignedVideoViewUrl(resolvedBucket, fileUrlOrKey, accessToken);
}

export async function resolveVideoUrl(
  videoUrlOrKey: string | null | undefined,
  accessToken?: string,
): Promise<string | null> {
  if (!videoUrlOrKey) return null;

  if (isFullUrl(videoUrlOrKey)) {
    return videoUrlOrKey;
  }

  return getSignedViewUrl(R2_BUCKET_VIDEOS, videoUrlOrKey, accessToken);
}

/**
 * Delete one or more screening videos from R2 via the Cloudflare Worker.
 * Silently ignores items without a key and 404 responses (object already gone).
 * Throws on other errors so callers can surface a toast.
 */
export async function deleteScreeningVideosFromR2(items: DeleteVideoItem[], accessToken?: string): Promise<void> {
  const targets = items
    .map((i) => ({ bucket: i.bucket || R2_BUCKET_VIDEOS, key: (i.key || "").trim() }))
    .filter((i) => i.key.length > 0 && !/^https?:\/\//i.test(i.key));

  if (targets.length === 0) return;

  const byBucket = new Map<string, string[]>();
  for (const target of targets) {
    const keys = byBucket.get(target.bucket) ?? [];
    keys.push(target.key);
    byBucket.set(target.bucket, keys);
  }

  const errors: string[] = [];

  for (const [bucket, keys] of byBucket) {
    try {
      await deleteObjects(bucket, keys, accessToken);
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : "Network error contacting storage");
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

/**
 * Calls the `get-invoice-download-url` Edge Function on the external Supabase
 * project and returns a short-lived signed PDF URL from Cloudflare R2.
 * The frontend never talks to the Cloudflare Worker directly.
 */
export async function getInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  if (!invoiceId) throw new Error("invoiceId is required");

  const { data, error } = await supabase.functions.invoke<{
    url: string;
    expires_in: number | null;
  }>("get-invoice-download-url", {
    body: { invoice_id: invoiceId },
  });

  if (error) {
    throw new Error(error.message || "Failed to get invoice download URL");
  }
  if (!data?.url) {
    throw new Error("No download URL returned");
  }
  return data.url;
}

/**
 * Calls the `request-invoice-pdf` Edge Function (super-admin only).
 * Generates or regenerates the invoice PDF on Cloudflare R2 and updates
 * `pdf_r2_key`, `pdf_generated_at`, and `pdf_version` on the invoice row.
 */
export async function requestInvoicePdf(invoiceId: string): Promise<unknown> {
  if (!invoiceId) throw new Error("invoiceId is required");

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    invoice: unknown;
  }>("request-invoice-pdf", {
    body: { invoice_id: invoiceId },
  });

  if (error) {
    throw new Error(error.message || "Failed to generate invoice PDF");
  }
  return data?.invoice;
}
