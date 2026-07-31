export type OperationalErrorSource =
  | "supabase"
  | "r2"
  | "browser_error"
  | "unhandled_rejection";

export interface SanitizedOperationalError {
  source: OperationalErrorSource;
  occurredAt: string;
  method?: string;
  status?: number;
  servicePath?: string;
  code?: string;
  message: string;
  pagePath: string;
  stack?: string;
}

export interface SupportEmailReport {
  reportId: string;
  receivedAt: string;
  companyId: string | null;
  userId: string | null;
  source: OperationalErrorSource;
  method: string | null;
  status: number | null;
  servicePath: string | null;
  code: string | null;
  message: string;
  pagePath: string;
  stack: string | null;
}

const SOURCES = new Set<OperationalErrorSource>([
  "supabase",
  "r2",
  "browser_error",
  "unhandled_rejection",
]);
const ALLOWED_FIELDS = new Set([
  "source",
  "occurredAt",
  "method",
  "status",
  "servicePath",
  "code",
  "message",
  "pagePath",
  "stack",
]);

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~-]+/gi;
const URL_QUERY_PATTERN = /((?:https?:\/\/|\/)[^\s?#]+)\?[^\s#]*/gi;

function boundedString(value: unknown, name: string, maxLength: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${name} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${name} is required`);
  return trimmed.slice(0, maxLength);
}

export function redactSensitiveText(value: string) {
  return value
    .replace(URL_QUERY_PATTERN, "$1?[redacted-query]")
    .replace(BEARER_PATTERN, "Bearer [redacted-token]")
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(UUID_PATTERN, "[redacted-id]");
}

function normalizedMessage(source: OperationalErrorSource, status?: number) {
  if (source === "supabase") {
    return status ? `Supabase request failed with status ${status}` : "Supabase network request failed";
  }
  if (source === "r2") {
    return status ? `R2 request failed with status ${status}` : "R2 network request failed";
  }
  if (source === "browser_error") return "Unhandled browser error";
  return "Unhandled promise rejection";
}

function sanitizeStack(value: unknown) {
  const stack = boundedString(value, "stack", 10_000);
  if (!stack) return undefined;
  const frames = stack
    .split("\n")
    .filter((line) => /^\s*at\s+/.test(line) || /@https?:\/\//.test(line))
    .slice(0, 20)
    .join("\n")
    .slice(0, 4000);
  return frames ? redactSensitiveText(frames) : undefined;
}

function sanitizePath(value: unknown, name: string) {
  const raw = boundedString(value, name, 1000);
  if (!raw) return undefined;

  let path = raw;
  try {
    path = new URL(raw, "https://report.invalid").pathname;
  } catch {
    path = raw.split(/[?#]/, 1)[0];
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return redactSensitiveText(path.slice(0, 500));
}

export function parseOperationalError(input: unknown): SanitizedOperationalError {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Report body must be an object");
  }

  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) throw new Error(`Unknown report field: ${key}`);
  }

  if (typeof body.source !== "string" || !SOURCES.has(body.source as OperationalErrorSource)) {
    throw new Error("Invalid report source");
  }

  const occurredAt = boundedString(body.occurredAt, "occurredAt", 40, true)!;
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("occurredAt must be an ISO timestamp");

  const methodValue = boundedString(body.method, "method", 12);
  const method = methodValue?.toUpperCase();
  if (method && !/^[A-Z]+$/.test(method)) throw new Error("Invalid HTTP method");

  let status: number | undefined;
  if (body.status !== undefined && body.status !== null) {
    if (!Number.isInteger(body.status) || Number(body.status) < 100 || Number(body.status) > 599) {
      throw new Error("Invalid HTTP status");
    }
    status = Number(body.status);
  }

  boundedString(body.message, "message", 1000, true);
  const pagePath = sanitizePath(body.pagePath, "pagePath");
  if (!pagePath) throw new Error("pagePath is required");

  const code = boundedString(body.code, "code", 120);
  const parsed: SanitizedOperationalError = {
    source: body.source as OperationalErrorSource,
    occurredAt: new Date(occurredAt).toISOString(),
    ...(method ? { method } : {}),
    ...(status ? { status } : {}),
    ...(sanitizePath(body.servicePath, "servicePath") ? { servicePath: sanitizePath(body.servicePath, "servicePath") } : {}),
    ...(code && /^[A-Za-z0-9_.-]+$/.test(code) ? { code } : {}),
    message: normalizedMessage(body.source as OperationalErrorSource, status),
    pagePath,
    ...(sanitizeStack(body.stack) ? { stack: sanitizeStack(body.stack) } : {}),
  };

  return parsed;
}

export async function hashActor(secret: string, actor: string) {
  if (secret.length < 16) throw new Error("ERROR_REPORT_HASH_SECRET is too short");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(actor));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function buildSupportEmail(report: SupportEmailReport) {
  const subject = `RizonHire ${report.source} failure${report.status ? ` (${report.status})` : ""}`.slice(0, 240);
  const details = [
    ["Report ID", report.reportId],
    ["Received", report.receivedAt],
    ["Company ID", report.companyId],
    ["User ID", report.userId],
    ["Source", report.source],
    ["Method", report.method],
    ["Status", report.status],
    ["Service path", report.servicePath],
    ["Code", report.code],
    ["Page path", report.pagePath],
    ["Message", report.message],
    ["Stack", report.stack],
  ];

  return {
    subject,
    html: `<h2>${escapeHtml(subject)}</h2><dl>${details.map(([label, value]) => (
      `<dt><strong>${escapeHtml(label)}</strong></dt><dd><pre>${escapeHtml(value ?? "—")}</pre></dd>`
    )).join("")}</dl>`,
  };
}
