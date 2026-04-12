const WORKER_URL = ""https://api.rizonhire.com/presign-upload"";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveVideoUrl(
  videoUrlOrKey: string | null | undefined
): Promise<string | null> {
  if (!videoUrlOrKey) return null;

  if (isFullUrl(videoUrlOrKey)) {
    return videoUrlOrKey;
  }

  // It's an R2 object key — request a signed/presigned URL from the Worker
  const res = await fetch(`${WORKER_URL}/presign-download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: videoUrlOrKey }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error("Failed to resolve video URL: " + errorText);
  }

  const { url } = await res.json();

  if (!url) {
    throw new Error("Invalid Worker response for video URL");
  }

  return url;
}
