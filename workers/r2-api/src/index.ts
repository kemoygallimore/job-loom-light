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
  RESEND_API_KEY: string;
  ALLOWED_ORIGINS?: string;

  INVOICE_BUCKET: R2Bucket;
  R2_WORKER_SECRET: string;
  BROWSER: any;
}

const INVOICE_BUCKET_NAME = "rizonhire-invoices";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://test.rizonhire.com",
  "https://app.rizonhire.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

type UploadFolder = "resumes" | "videos" | "documents";

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin) return "*";
  return allowedOrigins(env).includes(origin) ? origin : allowedOrigins(env)[0] ?? DEFAULT_ALLOWED_ORIGINS[0];
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

function isAuthorized(request: Request, env: Env) {
  const authHeader = request.headers.get("Authorization");
  return Boolean(env.R2_WORKER_SECRET && authHeader === `Bearer ${env.R2_WORKER_SECRET}`);
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

        if (request.headers.get("Authorization") && !isAuthorized(request, env)) {
          return json(request, env, { error: "Unauthorized" }, 401);
        }

        const keys = Array.from(new Set([...(body.keys ?? []), body.key].filter(Boolean) as string[]));
        if (keys.length === 0) {
          return json(request, env, { error: "Missing object key" }, 400);
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
				<p><strong>Name:</strong> ${name}</p>
				<p><strong>Email:</strong> ${email}</p>
				<p><strong>Company:</strong> ${company}</p>
				<p><strong>Phone:</strong> ${phone}</p>
				<p><strong>Message:</strong><br>${message}</p>
			`
			})
		});

		const resendData = await resendResponse.json<any>();

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
