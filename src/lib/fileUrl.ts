const BACKEND_URL = import.meta.env.VITE_UPLOAD_BACKEND_URL?.replace(/\/$/, "");

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveFileUrl(
  fileUrlOrKey: string | null | undefined
): Promise<string | null> {
  if (!fileUrlOrKey) return null;

  if (isFullUrl(fileUrlOrKey)) {
    return fileUrlOrKey;
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
      key: fileUrlOrKey,
      bucketType: "resumes",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to resolve file URL");
  }

  return data.downloadUrl || null;
}
