import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    loading: false,
    profile: null,
    role: null,
    user: null,
  }),
}));

vi.mock("./pages/Auth", () => ({
  default: () => <div>Auth page</div>,
}));

vi.mock("./components/AppLayout", () => ({
  default: () => <div>App layout</div>,
}));

vi.mock("./pages/NotFound", () => ({
  default: () => <div>Not Found route</div>,
}));

vi.mock("./pages/careers/CareersPage", () => ({
  default: () => <div>Careers page</div>,
}));

vi.mock("./pages/apply/PublicJobApplication", () => ({
  default: () => <div>Public application page</div>,
}));

describe("lazy public routes", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders direct careers links through the lazy route without falling through to NotFound", async () => {
    window.history.pushState({}, "", "/acme/careers");

    render(<App />);

    expect(screen.queryByText("Not Found route")).not.toBeInTheDocument();
    expect(await screen.findByText("Careers page")).toBeInTheDocument();
  });

  it("renders direct public application links through the lazy route without falling through to NotFound", async () => {
    window.history.pushState({}, "", "/apply/job-1");

    render(<App />);

    expect(screen.queryByText("Not Found route")).not.toBeInTheDocument();
    expect(await screen.findByText("Public application page")).toBeInTheDocument();
  });
});
