import {
  handleGenerateInvoicePdf,
  handleGetInvoiceDownloadUrl
} from "./invoicePdf";
import { AwsClient } from "aws4fetch";

export interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_RESUMES: string;
  R2_BUCKET_VIDEOS: string;
  R2_BUCKET_ADDITIONAL_DOCUMENTS: string;
  R2_EXPORTS_BUCKET?: string;
  RESEND_API_KEY: string;
  SUPPORT_ALERT_EMAIL?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  INVOICE_BUCKET: R2Bucket;
  R2_WORKER_SECRET: string;
  BROWSER: Fetcher;
}

const INVOICE_BUCKET_NAME = "rizonhire-invoices";
const DEFAULT_EXPORTS_BUCKET_NAME = "rizonhire-exports";
const DEFAULT_SUPPORT_ALERT_EMAIL = "support@rizonhire.com";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://test.rizonhire.com",
  "https://app.rizonhire.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

type UploadFolder = "resumes" | "videos" | "documents";

type SupabaseUser = {
  id: string;
};

type AuthResult =
  | { ok: true; kind: "worker" }
  | { ok: true; kind: "user"; userId: string; companyId: string }
  | { ok: false; status: 401 | 403 | 503; error: string; alert?: SupportAlert };

type SupabaseJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

type AvailabilityResult =
  | { ok: true; exists: boolean }
  | { ok: false; status: number; error: string };

type SupportAlert = {
  subject: string;
  details: Record<string, unknown>;
};

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  return origin && allowedOrigins(env).includes(origin) ? origin : "null";
}

function corsHeaders(request: Request, env: Env) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin(request, env),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(request: Request, env: Env, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request, env)
  });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getAllowedBucket(env: Env, bucket: string) {
  if (bucket === env.R2_BUCKET_VIDEOS) return env.R2_BUCKET_VIDEOS;
  if (bucket === env.R2_BUCKET_RESUMES) return env.R2_BUCKET_RESUMES;
  if (bucket === env.R2_BUCKET_ADDITIONAL_DOCUMENTS) return env.R2_BUCKET_ADDITIONAL_DOCUMENTS;
  if (bucket === INVOICE_BUCKET_NAME) return INVOICE_BUCKET_NAME;
  return null;
}

function getExportsBucket(env: Env, bucket: string) {
  const exportsBucket = env.R2_EXPORTS_BUCKET || DEFAULT_EXPORTS_BUCKET_NAME;
  return bucket === exportsBucket ? exportsBucket : null;
}

function getUploadBucket(env: Env, folder: string): string | null {
  const buckets: Record<UploadFolder, string> = {
    resumes: env.R2_BUCKET_RESUMES,
    videos: env.R2_BUCKET_VIDEOS,
    documents: env.R2_BUCKET_ADDITIONAL_DOCUMENTS,
  };
  return buckets[folder as UploadFolder] ?? null;
}

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function bearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization")?.trim() ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isWorkerSecretToken(token: string | null, env: Env) {
  return Boolean(env.R2_WORKER_SECRET && token === env.R2_WORKER_SECRET);
}

function supabaseUrl(env: Env, pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, env.SUPABASE_URL.replace(/\/+$/, "") + "/");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function supportAlertEmail(env: Env) {
  return (env.SUPPORT_ALERT_EMAIL || DEFAULT_SUPPORT_ALERT_EMAIL).trim();
}

async function sendSupportAlert(env: Env, alert: SupportAlert) {
  const recipient = supportAlertEmail(env);
  if (!recipient) return;

  if (!env.RESEND_API_KEY) {
    console.error("Support alert skipped: RESEND_API_KEY is not configured", alert);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RizonHire Alerts <info@rizonhire.com>",
        to: [recipient],
        subject: alert.subject.slice(0, 240),
        html: `
          <h2>${escapeHtml(alert.subject)}</h2>
          <pre>${escapeHtml(JSON.stringify(alert.details, null, 2))}</pre>
        `,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("Support alert send failed", { status: response.status, details, alert });
    }
  } catch (error) {
    console.error("Support alert request failed", { error, alert });
  }
}

async function fetchSupabaseJson<T>(
  env: Env,
  url: string,
  authorizationToken: string,
): Promise<SupabaseJsonResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authorizationToken}`,
      },
    });
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Supabase request failed" };
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { ok: false, status: response.status, error: errorText || response.statusText };
  }

  try {
    return { ok: true, data: await response.json<T>() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "Supabase response was not JSON" };
  }
}

async function getProfileCompanyId(env: Env, userId: string, token: string) {
  const profileUrl = supabaseUrl(env, "/rest/v1/profiles", {
    user_id: `eq.${userId}`,
    select: "company_id",
  });
  const profileResult = await fetchSupabaseJson<Array<{ company_id: string | null }>>(env, profileUrl, token);

  if (!profileResult.ok) return null;

  return profileResult.data[0]?.company_id ?? null;
}

async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
  const token = bearerToken(request);

  if (isWorkerSecretToken(token, env)) {
    return { ok: true, kind: "worker" };
  }

  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const userResult = await fetchSupabaseJson<SupabaseUser>(
    env,
    supabaseUrl(env, "/auth/v1/user"),
    token,
  );

  if (!userResult.ok || !userResult.data?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const companyId = await getProfileCompanyId(env, userResult.data.id, token);
  if (!companyId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, kind: "user", userId: userResult.data.id, companyId };
}

function keyBelongsToCompany(key: string, companyId: string) {
  const [folder, keyCompanyId] = key.split("/");
  return Boolean(folder && keyCompanyId && key.startsWith(`${folder}/${companyId}/`));
}

function validExportKey(key: string) {
  const parts = key.split("/");
  return parts.length >= 4 && parts[0] === "exports" && Boolean(parts[1]) && Boolean(parts[2]) && Boolean(parts[3]);
}

function contentTypeAllowed(folder: UploadFolder, contentType: string) {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const documentTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
  ]);

  if (folder === "videos") return normalized.startsWith("video/");
  if (folder === "documents") return documentTypes.has(normalized);

  return new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]).has(normalized);
}

async function hasOpenJob(env: Env, companyId: string, jobId: string): Promise<AvailabilityResult> {
  const jobsUrl = supabaseUrl(env, "/rest/v1/jobs", {
    id: `eq.${jobId}`,
    company_id: `eq.${companyId}`,
    status: "eq.open",
    select: "id",
  });
  const result = await fetchSupabaseJson<Array<{ id: string }>>(env, jobsUrl, env.SUPABASE_ANON_KEY);
  if (!result.ok) return result;
  return { ok: true, exists: result.data.length > 0 };
}

async function hasActiveLeadForm(env: Env, companyId: string, formId: string): Promise<AvailabilityResult> {
  const formUrl = supabaseUrl(env, "/rest/v1/lead_forms", {
    id: `eq.${formId}`,
    company_id: `eq.${companyId}`,
    status: "eq.active",
    deleted_at: "is.null",
    select: "id",
  });
  const result = await fetchSupabaseJson<Array<{ id: string }>>(env, formUrl, env.SUPABASE_ANON_KEY);
  if (!result.ok) return result;
  return { ok: true, exists: result.data.length > 0 };
}

function uploadVerificationUnavailableAlert(args: {
  request: Request;
  folder: UploadFolder;
  companyId: string;
  jobId: string;
  check: "jobs" | "lead_forms";
  result: { status: number; error: string };
}): AuthResult {
  return {
    ok: false,
    status: 503,
    error: "Upload verification unavailable",
    alert: {
      subject: "RizonHire upload verification failed",
      details: {
        route: new URL(args.request.url).pathname,
        check: args.check,
        status: args.result.status,
        error: args.result.error,
        folder: args.folder,
        company_id: args.companyId,
        job_id: args.jobId,
        origin: args.request.headers.get("Origin"),
      },
    },
  };
}

async function canPresignUpload(
  request: Request,
  env: Env,
  folder: UploadFolder,
  companyId: string,
  jobId: string,
): Promise<AuthResult> {
  const token = bearerToken(request);

  if (token) {
    const auth = await authenticateRequest(request, env);
    if (!auth.ok) return auth;
    if (auth.kind === "worker") return auth;
    if (auth.companyId !== companyId) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return auth;
  }

  if (jobId) {
    const jobResult = await hasOpenJob(env, companyId, jobId);
    if (!jobResult.ok) {
      return uploadVerificationUnavailableAlert({
        request,
        folder,
        companyId,
        jobId,
        check: "jobs",
        result: jobResult,
      });
    }
    if (jobResult.exists) return { ok: true, kind: "worker" };
  }

  if (folder === "documents" && jobId) {
    const leadFormResult = await hasActiveLeadForm(env, companyId, jobId);
    if (!leadFormResult.ok) {
      return uploadVerificationUnavailableAlert({
        request,
        folder,
        companyId,
        jobId,
        check: "lead_forms",
        result: leadFormResult,
      });
    }
    if (leadFormResult.exists) return { ok: true, kind: "worker" };
  }

  return { ok: false, status: 403, error: "Forbidden" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin(request, env),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/invoices/generate-pdf") {
      return handleGenerateInvoicePdf(request, env);
    }

    const invoiceDownloadMatch = url.pathname.match(/^\/invoices\/([^/]+)\/download$/);

    if (request.method === "GET" && invoiceDownloadMatch) {
      const invoiceId = invoiceDownloadMatch[1];
      return handleGetInvoiceDownloadUrl(request, env, invoiceId);
    }

    const path = normalizePath(url.pathname);

    try {
      const aws = new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto"
      });

      if (path === "/exports/upload" && request.method === "POST") {
        const auth = await authenticateRequest(request, env);
        if (!auth.ok) {
          return json(request, env, { error: auth.error }, auth.status);
        }
        if (auth.kind !== "worker") {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const bucket = getExportsBucket(env, request.headers.get("x-export-bucket") || "");
        const key = request.headers.get("x-export-key") || "";
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        if (!bucket) return json(request, env, { error: "Invalid export bucket" }, 400);
        if (!validExportKey(key)) return json(request, env, { error: "Invalid export key" }, 400);
        if (contentType.split(";")[0].trim().toLowerCase() !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
          return json(request, env, { error: "Invalid export content type" }, 400);
        }

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const objectUrl = `https://${endpoint}/${bucket}/${key}`;
        const signed = await aws.sign(objectUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          aws: { signQuery: true }
        });
        const uploadRes = await fetch(signed.url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: await request.arrayBuffer()
        });
        if (!uploadRes.ok) {
          const errorText = await uploadRes.text().catch(() => "");
          return json(request, env, { error: "Upload failed", details: errorText }, uploadRes.status);
        }

        return json(request, env, { success: true, bucket, key });
      }

      if (path === "/exports/sign-download" && request.method === "POST") {
        const auth = await authenticateRequest(request, env);
        if (!auth.ok) {
          return json(request, env, { error: auth.error }, auth.status);
        }
        if (auth.kind !== "worker") {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const body = await request.json<{ bucket: string; key: string }>();
        const bucket = getExportsBucket(env, body.bucket);
        if (!bucket) return json(request, env, { error: "Invalid export bucket" }, 400);
        if (!validExportKey(body.key)) return json(request, env, { error: "Invalid export key" }, 400);

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const objectUrl = `https://${endpoint}/${bucket}/${body.key}?X-Amz-Expires=900`;
        const signed = await aws.sign(objectUrl, {
          method: "GET",
          aws: { signQuery: true }
        });

        return json(request, env, { url: signed.url, expires_in: 900 });
      }

      if (path === "/exports/delete" && request.method === "POST") {
        const auth = await authenticateRequest(request, env);
        if (!auth.ok) {
          return json(request, env, { error: auth.error }, auth.status);
        }
        if (auth.kind !== "worker") {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const body = await request.json<{ bucket: string; key: string }>();
        const bucket = getExportsBucket(env, body.bucket);
        if (!bucket) return json(request, env, { error: "Invalid export bucket" }, 400);
        if (!validExportKey(body.key)) return json(request, env, { error: "Invalid export key" }, 400);

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const objectUrl = `https://${endpoint}/${bucket}/${body.key}`;
        const signed = await aws.sign(objectUrl, {
          method: "DELETE",
          aws: { signQuery: true }
        });
        const deleteRes = await fetch(signed.url, { method: "DELETE" });
        if (!deleteRes.ok && deleteRes.status !== 404) {
          const errorText = await deleteRes.text().catch(() => "");
          return json(request, env, { error: "Delete failed", details: errorText }, deleteRes.status);
        }

        return json(request, env, { success: true, deleted: [body.key] });
      }

      if (path === "/presign-upload" && request.method === "POST") {
        const body = await request.json<{
          filename: string;
          contentType: string;
          companyId?: string;
          jobId?: string;
          folder?: string;
          candidateId?: string;
        }>();

        const filename = sanitizeFilename(body.filename || "file.bin");
        const contentType = body.contentType || "application/octet-stream";
        const folder = body.folder || "";
        const companyId = body.companyId || "company";
        const jobId = body.jobId || "job";

        const bucket = getUploadBucket(env, folder);
        if (!bucket) {
          return json(request, env, { error: "Invalid upload folder" }, 400);
        }

        const uploadFolder = folder as UploadFolder;
        if (!contentTypeAllowed(uploadFolder, contentType)) {
          return json(request, env, { error: "Invalid content type" }, 400);
        }

        const auth = await canPresignUpload(request, env, uploadFolder, companyId, jobId);
        if (!auth.ok) {
          if (auth.alert) {
            console.error("Upload presign verification failed", auth.alert.details);
            await sendSupportAlert(env, auth.alert);
          }
          return json(request, env, { error: auth.error }, auth.status);
        }

        const objectKey = `${folder}/${companyId}/${jobId}/${Date.now()}-${filename}`;

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const objectUrl = `https://${endpoint}/${bucket}/${objectKey}`;

        const signed = await aws.sign(objectUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType
          },
          aws: {
            signQuery: true
          }
        });

        return json(request, env, {
          uploadUrl: signed.url,
          key: objectKey,
          bucket
        });
      }

      if (path === "/sign-view" && request.method === "POST") {
        const body = await request.json<{
          bucket: string;
          key: string;
        }>();

        const bucket = getAllowedBucket(env, body.bucket);
        if (!bucket) {
          return json(request, env, { error: "Invalid bucket" }, 400);
        }

        if (!body.key) {
          return json(request, env, { error: "Missing object key" }, 400);
        }

        const auth = await authenticateRequest(request, env);
        if (!auth.ok) {
          return json(request, env, { error: auth.error }, auth.status);
        }

        if (auth.kind === "user" && !keyBelongsToCompany(body.key, auth.companyId)) {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const objectUrl = `https://${endpoint}/${bucket}/${body.key}`;

        const signed = await aws.sign(objectUrl, {
          method: "GET",
          aws: {
            signQuery: true
          }
        });

        return json(request, env, {
          viewUrl: signed.url
        });
      }

      if (path === "/delete-object" && request.method === "POST") {
        const body = await request.json<{
          bucket: string;
          keys?: string[];
          key?: string;
        }>();

        const bucket = getAllowedBucket(env, body.bucket);
        if (!bucket) {
          return json(request, env, { error: "Invalid bucket" }, 400);
        }

        const keys = Array.from(new Set([...(body.keys ?? []), body.key].filter(Boolean) as string[]));
        if (keys.length === 0) {
          return json(request, env, { error: "Missing object key" }, 400);
        }

        const auth = await authenticateRequest(request, env);
        if (!auth.ok) {
          return json(request, env, { error: auth.error }, auth.status);
        }

        if (auth.kind === "user" && keys.some((key) => !keyBelongsToCompany(key, auth.companyId))) {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const endpoint = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const deleted: string[] = [];

        for (const key of keys) {
          const objectUrl = `https://${endpoint}/${bucket}/${key}`;
          const signed = await aws.sign(objectUrl, {
            method: "DELETE",
            aws: {
              signQuery: true
            }
          });
          const deleteRes = await fetch(signed.url, { method: "DELETE" });
          if (!deleteRes.ok && deleteRes.status !== 404) {
            const errorText = await deleteRes.text().catch(() => "");
            return json(request, env, { error: "Delete failed", key, details: errorText }, deleteRes.status);
          }
          deleted.push(key);
        }

        return json(request, env, { success: true, deleted });
      }

      if (path === "/send-lead-email" && request.method === "POST") {
        const origin = request.headers.get("Origin");
        if (origin && !allowedOrigins(env).includes(origin)) {
          return json(request, env, { error: "Forbidden" }, 403);
        }

        const body = await request.json<{
          name: string;
          email: string;
          company?: string;
          phone?: string;
          message: string;
        }>();

        const name = body.name?.trim();
        const email = body.email?.trim();
        const company = body.company?.trim() || "Not provided";
        const phone = body.phone?.trim() || "Not provided";
        const message = body.message?.trim();

        if (!name || !email || !message) {
          return json(request, env, { error: "Missing required fields" }, 400);
        }

        if (message.length > 5000) {
          return json(request, env, { error: "Message too long" }, 400);
        }

        const escapedName = escapeHtml(name);
        const escapedEmail = escapeHtml(email);
        const escapedCompany = escapeHtml(company);
        const escapedPhone = escapeHtml(phone);
        const escapedMessage = escapeHtml(message);

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Leads <info@rizonhire.com>",
            to: ["info@rizonhire.com"],
            subject: `New Landing Page Lead from ${name}`,
            reply_to: email,
            html: `
              <h2>New Lead Submission</h2>
              <p><strong>Name:</strong> ${escapedName}</p>
              <p><strong>Email:</strong> ${escapedEmail}</p>
              <p><strong>Company:</strong> ${escapedCompany}</p>
              <p><strong>Phone:</strong> ${escapedPhone}</p>
              <p><strong>Message:</strong><br>${escapedMessage}</p>
            `
          })
        });

        const resendData: unknown = await resendResponse.json();

        if (!resendResponse.ok) {
          return json(
            request,
            env,
            {
              error: "Failed to send email through Resend",
              details: resendData
            },
            500
          );
        }

        return json(request, env, {
          success: true,
          resend: resendData
        });
      }

      return json(
        request,
        env,
        {
          error: "Not found",
          pathname: url.pathname,
          normalizedPath: path,
          method: request.method
        },
        404
      );
    } catch (err) {
      console.error("Worker request failed", { path, error: err });
      await sendSupportAlert(env, {
        subject: "RizonHire Worker request failed",
        details: {
          path,
          method: request.method,
          error: err instanceof Error ? err.message : "Unknown error",
          origin: request.headers.get("Origin"),
        },
      });
      return json(
        request,
        env,
        {
          error: "Worker request failed",
          details: err instanceof Error ? err.message : "Unknown error"
        },
        500
      );
    }
  }
};
