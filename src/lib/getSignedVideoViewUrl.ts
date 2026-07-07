import { R2_BUCKET_VIDEOS, getSignedR2Url } from "@/lib/r2Worker";

export async function getSignedVideoViewUrl(
  bucket: string | null | undefined,
  key: string | null | undefined,
): Promise<string> {
  const resolvedKey = key ?? "";
  const resolvedBucket = bucket ?? R2_BUCKET_VIDEOS;

  if (!resolvedKey) {
    throw new Error("No video key available");
  }

  return getSignedR2Url(resolvedBucket, resolvedKey);
}
