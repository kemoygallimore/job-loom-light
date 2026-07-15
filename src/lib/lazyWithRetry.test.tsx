import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, lazyWithRetry, recoverFromChunkLoadError } from "./lazyWithRetry";

describe("lazyWithRetry", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("detects stale dynamic import failures", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://test.rizonhire.com/assets/Dashboard-abc.js",
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 12 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
  });

  it("only triggers one automatic recovery reload per tab", () => {
    const reload = vi.fn();

    expect(recoverFromChunkLoadError(reload)).toBe(true);
    expect(recoverFromChunkLoadError(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears the recovery marker after a lazy import succeeds", async () => {
    const reload = vi.fn();
    const Loaded = () => <div>Loaded route</div>;
    const LazyLoaded = lazyWithRetry(() => Promise.resolve({ default: Loaded }));

    recoverFromChunkLoadError(reload);

    render(
      <Suspense fallback={<div>Loading</div>}>
        <LazyLoaded />
      </Suspense>,
    );

    expect(await screen.findByText("Loaded route")).toBeInTheDocument();

    expect(recoverFromChunkLoadError(reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
