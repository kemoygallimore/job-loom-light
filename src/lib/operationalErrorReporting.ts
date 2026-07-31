import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";

export type OperationalErrorSource =
  | "supabase"
  | "r2"
  | "browser_error"
  | "unhandled_rejection";

export interface OperationalErrorPayload {
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

export type OperationalErrorSender = (
  payload: OperationalErrorPayload,
  authorization?: string,
) => void;

const REPORTING_PATH = "/functions/v1/report-client-error";
const capturedFetch = globalThis.fetch?.bind(globalThis);

let currentAccessToken: string | undefined;

function sanitizePath(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;

  try {
    const parsed = new URL(value, globalThis.location?.origin ?? "http://localhost");
    return parsed.pathname || fallback;
  } catch {
    return value.split(/[?#]/, 1)[0] || fallback;
  }
}

function currentPagePath(): string {
  return sanitizePath(globalThis.location?.pathname, "/");
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request ? input : undefined;
  const rawUrl = request?.url ?? String(input);
  const headers = new Headers(init?.headers ?? request?.headers);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const authorization = headers.get("authorization") ?? undefined;

  return {
    authorization,
    method,
    servicePath: sanitizePath(rawUrl),
    isReportingRequest: sanitizePath(rawUrl) === REPORTING_PATH,
  };
}

async function responseErrorCode(response: Response): Promise<string | undefined> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return undefined;
  }

  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    const codeValue = body.code;
    return typeof codeValue === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(codeValue)
      ? codeValue
      : undefined;
  } catch {
    return undefined;
  }
}

function stackFrames(error: Error): string | undefined {
  const frames = error.stack
    ?.split("\n")
    .filter((line) => /^\s*at\s+/.test(line) || /@https?:\/\//.test(line))
    .slice(0, 20)
    .join("\n");
  return frames || undefined;
}

export function setOperationalErrorAccessToken(token?: string | null): void {
  currentAccessToken = token || undefined;
}

export function reportOperationalError(
  payload: OperationalErrorPayload,
  authorization?: string,
): void {
  if (!capturedFetch) return;

  const bearer = authorization?.startsWith("Bearer ")
    ? authorization
    : currentAccessToken
      ? `Bearer ${currentAccessToken}`
      : `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;

  void capturedFetch(`${SUPABASE_URL}${REPORTING_PATH}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: bearer,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      pagePath: sanitizePath(payload.pagePath),
      servicePath: payload.servicePath
        ? sanitizePath(payload.servicePath)
        : undefined,
    }),
    keepalive: true,
  }).catch(() => {
    // Reporting is deliberately best-effort and must never affect the app flow.
  });
}

export function createInstrumentedFetch(
  nativeFetch: typeof fetch,
  sendReport: OperationalErrorSender = reportOperationalError,
  pagePath: () => string = currentPagePath,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const details = requestDetails(input, init);

    try {
      const response = await nativeFetch(input, init);

      if (!response.ok && !details.isReportingRequest) {
        const code = await responseErrorCode(response);
        sendReport(
          {
            source: "supabase",
            occurredAt: new Date().toISOString(),
            method: details.method,
            status: response.status,
            servicePath: details.servicePath,
            code,
            message: `Supabase request failed with status ${response.status}`,
            pagePath: sanitizePath(pagePath()),
          },
          details.authorization,
        );
      }

      return response;
    } catch (error) {
      if (!details.isReportingRequest) {
        const exception = error instanceof Error ? error : undefined;
        sendReport(
          {
            source: "supabase",
            occurredAt: new Date().toISOString(),
            method: details.method,
            servicePath: details.servicePath,
            message: "Supabase network request failed",
            pagePath: sanitizePath(pagePath()),
            stack: exception ? stackFrames(exception) : undefined,
          },
          details.authorization,
        );
      }

      throw error;
    }
  }) as typeof fetch;
}

export function installGlobalErrorReporting(
  sendReport: OperationalErrorSender = reportOperationalError,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : undefined;
    sendReport({
      source: "browser_error",
      occurredAt: new Date().toISOString(),
      message: error ? `${error.name}: Unhandled browser error` : "Unhandled browser error",
      pagePath: currentPagePath(),
      stack: error ? stackFrames(error) : undefined,
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : undefined;
    sendReport({
      source: "unhandled_rejection",
      occurredAt: new Date().toISOString(),
      message: error ? `${error.name}: Unhandled promise rejection` : "Unhandled promise rejection",
      pagePath: currentPagePath(),
      stack: error ? stackFrames(error) : undefined,
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
