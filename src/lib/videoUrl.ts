import { R2_BUCKET_VIDEOS, getSignedR2Url } from "@/lib/r2Worker";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveVideoUrl(videoUrlOrKey: string | null | undefined, accessToken?: string): Promise<string | null> {
  if (!videoUrlOrKey) return null;

  if (isFullUrl(videoUrlOrKey)) {
    return videoUrlOrKey;
  }

  return getSignedR2Url(R2_BUCKET_VIDEOS, videoUrlOrKey, accessToken);
}
