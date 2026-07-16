import { lazy, type ComponentType } from "react";

const CHUNK_RELOAD_STORAGE_KEY = "rizonhire:chunk-load-reloaded";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "string") return error;
  return "";
}

export function isChunkLoadError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("chunkloaderror") ||
    message.includes("loading chunk")
  );
}

function hasRetriedChunkLoad() {
  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function markChunkLoadRetried() {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, "true");
  } catch {
    // If storage is blocked, skip automatic recovery to avoid a reload loop.
  }
}

function clearChunkLoadRetry() {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
  } catch {
    // Storage access can fail in privacy modes; the successful import is enough.
  }
}

export function recoverFromChunkLoadError(reload = () => window.location.reload()) {
  if (hasRetriedChunkLoad()) return false;

  markChunkLoadRetried();
  reload();
  return true;
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      clearChunkLoadRetry();
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && recoverFromChunkLoadError()) {
        return new Promise<never>(() => {});
      }

      throw error;
    }
  });
}
