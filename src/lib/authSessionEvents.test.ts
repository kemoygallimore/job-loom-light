import { describe, expect, it, vi } from "vitest";
import {
  publishUnauthorizedSession,
  subscribeToUnauthorizedSession,
} from "./authSessionEvents";

describe("unauthorized session events", () => {
  it("notifies active subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUnauthorizedSession(listener);

    publishUnauthorizedSession();
    unsubscribe();
    publishUnauthorizedSession();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
