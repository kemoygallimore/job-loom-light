import { R2_BUCKET_VIDEOS, deleteR2Objects } from "@/lib/r2Worker";

export interface DeleteVideoItem {
  bucket: string | null | undefined;
  key: string | null | undefined;
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

  // Group by bucket so we can batch via { bucket, keys: [] }
  const byBucket = new Map<string, string[]>();
  for (const t of targets) {
    const arr = byBucket.get(t.bucket) ?? [];
    arr.push(t.key);
    byBucket.set(t.bucket, arr);
  }

  const errors: string[] = [];

  for (const [bucket, keys] of byBucket) {
    try {
      await deleteR2Objects(bucket, keys, accessToken);
    } catch (err: any) {
      errors.push(err?.message || "Network error contacting storage");
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}
