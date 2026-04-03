const BACKEND_BASE_URL = "https://job-loom-light-backend.onrender.com";

/**
 * Resolves a video URL for playback.
 * - If the value is already a full URL (legacy Supabase Storage), return as-is.
 * - If it's an R2 key, fetch a signed download URL from the Render backend.
 */
export async function resolveVideoUrl(videoUrlOrKey: string): Promise<string> {
  if (videoUrlOrKey.startsWith("http://") || videoUrlOrKey.startsWith("https://")) {
    return videoUrlOrKey;
  }

  const response = await fetch(`${BACKEND_BASE_URL}/api/download-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: videoUrlOrKey }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to get video download URL");
  }

  return data.url;
}
