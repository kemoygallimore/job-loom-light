import { getSignedVideoViewUrl } from "@/lib/getSignedVideoViewUrl";
import { R2_BUCKET_RESUMES } from "@/lib/r2Worker";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
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

  // Use R2 Worker signed URL
  const resolvedBucket = bucket || R2_BUCKET_RESUMES;
  return getSignedVideoViewUrl(resolvedBucket, fileUrlOrKey, accessToken);
}
