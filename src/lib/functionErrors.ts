export const SESSION_EXPIRED_MESSAGE = "Your session expired or is no longer valid. Please sign in again.";

function responseContext(error: unknown): Response | null {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

async function serverErrorMessage(response: Response): Promise<string | null> {
  if (!response.headers.get("content-type")?.includes("application/json")) return null;

  try {
    const body = await response.clone().json() as { error?: unknown };
    if (typeof body.error !== "string") return null;
    const message = body.error.trim();
    return message ? message.slice(0, 300) : null;
  } catch {
    return null;
  }
}

export async function functionErrorMessage(
  error: unknown,
  fallback = "The request could not be completed",
): Promise<string> {
  const response = responseContext(error);
  if (response?.status === 401) return SESSION_EXPIRED_MESSAGE;

  if (response) {
    const serverMessage = await serverErrorMessage(response);
    if (serverMessage) return serverMessage;
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
