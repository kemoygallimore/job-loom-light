import { reportOperationalError } from "@/lib/operationalErrorReporting";

const DEFAULT_WORKER_URL = "https://api.rizonhire.com";

export const R2_BUCKET_RESUMES = "silverweb-ats-resumes";
export const R2_BUCKET_VIDEOS = "silverweb-ats-videos";
export const R2_BUCKET_ADDITIONAL_DOCUMENTS = "silverweb-additional-documents";

export type R2UploadFolder = "resumes" | "videos" | "documents";

export interface UploadR2FileParams {
  file: File;
  folder: R2UploadFolder;
  companyId: string;
  candidateId: string;
  jobId?: string;
  fieldId?: string;
  fallbackContentType?: string;
  accessToken?: string;
}

export interface UploadR2FileResult {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

export function getR2WorkerUrl() {
  const configured = import.meta.env.VITE_UPLOAD_BACKEND_URL as string | undefined;
  return (configured || DEFAULT_WORKER_URL).replace(/\/+$/, "");
}

async function responseText(response: Response) {
  return response.text().catch(() => "");
}

function uploadHost(uploadUrl: string) {
  try {
    return new URL(uploadUrl).host;
  } catch {
    return "R2";
  }
}

function workerHeaders(accessToken?: string) {
  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

function reportR2Failure({
  method,
  servicePath,
  accessToken,
  status,
  error,
}: {
  method: string;
  servicePath: string;
  accessToken?: string;
  status?: number;
  error?: unknown;
}) {
  const exception = error instanceof Error ? error : undefined;
  reportOperationalError(
    {
      source: "r2",
      occurredAt: new Date().toISOString(),
      method,
      status,
      servicePath,
      message: status ? `R2 request failed with status ${status}` : "R2 network request failed",
      pagePath: typeof window === "undefined" ? "/" : window.location.pathname,
      stack: exception?.stack
        ?.split("\n")
        .filter((line) => /^\s*at\s+/.test(line) || /@https?:\/\//.test(line))
        .slice(0, 20)
        .join("\n") || undefined,
    },
    accessToken ? `Bearer ${accessToken}` : undefined,
  );
}

export async function uploadFileToR2({
  file,
  folder,
  companyId,
  candidateId,
  jobId,
  fieldId,
  fallbackContentType = "application/octet-stream",
  accessToken,
}: UploadR2FileParams): Promise<UploadR2FileResult> {
  const workerUrl = getR2WorkerUrl();
  const contentType = file.type || fallbackContentType;

  let presignRes: Response;
  try {
    presignRes = await fetch(`${workerUrl}/presign-upload`, {
      method: "POST",
      headers: workerHeaders(accessToken),
      body: JSON.stringify({
        filename: file.name,
        contentType,
        folder,
        companyId,
        candidateId,
        ...(jobId ? { jobId } : {}),
        ...(fieldId ? { fieldId } : {}),
      }),
    });
  } catch (error) {
    reportR2Failure({ method: "POST", servicePath: "/presign-upload", accessToken, error });
    console.error("R2 presign request failed", { workerUrl, folder, contentType, size: file.size, error });
    throw new Error("Could not reach the file upload service. Please try again.");
  }

  if (!presignRes.ok) {
    reportR2Failure({ method: "POST", servicePath: "/presign-upload", accessToken, status: presignRes.status });
    const errorText = await responseText(presignRes);
    throw new Error(`Could not prepare file upload: ${errorText || presignRes.statusText}`);
  }

  const { uploadUrl, key, bucket } = await presignRes.json();

  if (!uploadUrl || !key || !bucket) {
    throw new Error("The file upload service returned an invalid response.");
  }

  let uploadRes: Response;
  try {
    uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch (error) {
    reportR2Failure({ method: "PUT", servicePath: "/direct-upload", accessToken, error });
    console.error("R2 direct upload failed", {
      uploadHost: uploadHost(uploadUrl),
      bucket,
      folder,
      contentType,
      size: file.size,
      error,
    });
    throw new Error("The file could not be uploaded to storage. Check the R2 bucket CORS settings and try again.");
  }

  if (!uploadRes.ok) {
    reportR2Failure({ method: "PUT", servicePath: "/direct-upload", accessToken, status: uploadRes.status });
    const errorText = await responseText(uploadRes);
    throw new Error(`File storage rejected the upload: ${errorText || uploadRes.statusText}`);
  }

  return {
    bucket,
    key,
    filename: file.name,
    contentType,
    size: file.size,
  };
}

export async function getSignedR2Url(bucket: string, key: string, accessToken?: string): Promise<string> {
  const workerUrl = getR2WorkerUrl();
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/sign-view`, {
      method: "POST",
      headers: workerHeaders(accessToken),
      body: JSON.stringify({ bucket, key }),
    });
  } catch (error) {
    reportR2Failure({ method: "POST", servicePath: "/sign-view", accessToken, error });
    throw error;
  }

  if (!res.ok) {
    reportR2Failure({ method: "POST", servicePath: "/sign-view", accessToken, status: res.status });
    const errorText = await responseText(res);
    throw new Error(`Failed to get signed file URL: ${errorText || res.statusText}`);
  }

  const { viewUrl } = await res.json();

  if (!viewUrl) {
    throw new Error("Invalid Worker response: missing viewUrl");
  }

  return viewUrl;
}

export async function deleteR2Objects(bucket: string, keys: string[], accessToken?: string) {
  const workerUrl = getR2WorkerUrl();
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/delete-object`, {
      method: "POST",
      headers: workerHeaders(accessToken),
      body: JSON.stringify({ bucket, keys }),
    });
  } catch (error) {
    reportR2Failure({ method: "POST", servicePath: "/delete-object", accessToken, error });
    throw error;
  }

  if (!res.ok) {
    reportR2Failure({ method: "POST", servicePath: "/delete-object", accessToken, status: res.status });
  }

  if (!res.ok && res.status !== 404) {
    const errorText = await responseText(res);
    throw new Error(`R2 delete failed (${res.status}): ${errorText || res.statusText}`);
  }
}
