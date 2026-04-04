const BACKEND_URL =
  import.meta.env.VITE_UPLOAD_BACKEND_URL?.replace(/\/$/, "") || "https://job-loom-light-backend.onrender.com";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveVideoUrl(videoUrlOrKey: string | null | undefined): Promise<string | null> {
  if (!videoUrlOrKey) return null;

  if (isFullUrl(videoUrlOrKey)) {
    return videoUrlOrKey;
  }

  if (!BACKEND_URL) {
    throw new Error("Missing VITE_UPLOAD_BACKEND_URL");
  }

  const response = await fetch(`${BACKEND_URL}/api/download-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: videoUrlOrKey,
      bucketType: "videos",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to resolve video URL");
  }

  return data.downloadUrl || null;
}
