const WORKER_URL = "https://silverweb-ats.solutionssilverweb.workers.dev";
const DEFAULT_BUCKET = "silverweb-ats-videos";

export async function getSignedVideoViewUrl(
  bucket: string | null | undefined,
  key: string | null | undefined
): Promise<string> {
  const resolvedKey = key ?? "";
  const resolvedBucket = bucket ?? DEFAULT_BUCKET;

  if (!resolvedKey) {
    throw new Error("No video key available");
  }

  const res = await fetch(`${WORKER_URL}/sign-view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket: resolvedBucket, key: resolvedKey }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get signed video URL: ${errorText}`);
  }

  const { viewUrl } = await res.json();

  if (!viewUrl) {
    throw new Error("Invalid Worker response: missing viewUrl");
  }

  return viewUrl;
}
