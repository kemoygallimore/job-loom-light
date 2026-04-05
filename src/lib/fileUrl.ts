import { getSignedVideoViewUrl } from "@/lib/getSignedVideoViewUrl";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveFileUrl(
  fileUrlOrKey: string | null | undefined,
  bucket?: string | null
): Promise<string | null> {
  if (!fileUrlOrKey) return null;

  if (isFullUrl(fileUrlOrKey)) {
    return fileUrlOrKey;
  }

  // Use R2 Worker signed URL
  const resolvedBucket = bucket || "silverweb-ats-resumes";
  return getSignedVideoViewUrl(resolvedBucket, fileUrlOrKey);
}
