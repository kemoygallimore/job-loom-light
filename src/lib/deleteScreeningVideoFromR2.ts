const WORKER_URL = "https://api.rizonhire.com";
const DEFAULT_BUCKET = "silverweb-ats-videos";

export interface DeleteVideoItem {
  bucket: string | null | undefined;
  key: string | null | undefined;
}

/**
 * Delete one or more screening videos from R2 via the Cloudflare Worker.
 * Silently ignores items without a key and 404 responses (object already gone).
 * Throws on other errors so callers can surface a toast.
 */
export async function deleteScreeningVideosFromR2(items: DeleteVideoItem[]): Promise<void> {
  const targets = items
    .map((i) => ({ bucket: i.bucket || DEFAULT_BUCKET, key: (i.key || "").trim() }))
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
      const res = await fetch(`${WORKER_URL}/delete-object`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, keys }),
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => "");
        errors.push(`R2 delete failed (${res.status}): ${text}`);
      }
    } catch (err: any) {
      errors.push(err?.message || "Network error contacting storage");
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}