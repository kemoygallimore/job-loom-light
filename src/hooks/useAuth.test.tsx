import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishUnauthorizedSession } from "@/lib/authSessionEvents";
import { AuthProvider, useAuth } from "./useAuth";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      getUser: authMocks.getUser,
      onAuthStateChange: authMocks.onAuthStateChange,
      signOut: authMocks.signOut,
    },
    from: authMocks.from,
  },
}));

const user = {
  id: "user-1",
  email: "user@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-08-13T09:00:00.000Z",
};

const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Consumer() {
  const { user: currentUser, loading, sessionExpired, signOut } = useAuth();
  return (
    <>
      <span data-testid="identity">{loading ? "loading" : currentUser?.id ?? "signed-out"}</span>
      <span data-testid="session-state">{sessionExpired ? "expired" : "active"}</span>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

function renderProvider(children: ReactNode = <Consumer />) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getSession.mockResolvedValue({ data: { session }, error: null });
  authMocks.getUser.mockResolvedValue({ data: { user }, error: null });
  authMocks.signOut.mockResolvedValue({ error: null });
  authMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  authMocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => table === "profiles"
          ? { data: { id: "profile-1", user_id: user.id, company_id: "company-1", name: "User", email: user.email }, error: null }
          : { data: { role: "admin" }, error: null },
      }),
    }),
  }));
});

describe("AuthProvider session recovery", () => {
  it("does not expose a restored user until the server validates the session", async () => {
    const validation = deferred<{ data: { user: typeof user }; error: null }>();
    authMocks.getUser.mockReturnValue(validation.promise);

    renderProvider();

    expect(screen.getByTestId("identity")).toHaveTextContent("loading");
    await waitFor(() => expect(authMocks.getUser).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("identity")).toHaveTextContent("loading");
    await act(async () => validation.resolve({ data: { user }, error: null }));
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(user.id));
  });

  it("clears a restored session that Supabase explicitly rejects", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401, code: "session_not_found", message: "Session not found" },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("signed-out"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("expired");
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("preserves the restored session when validation fails because of the network", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 0, message: "Failed to fetch" },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(user.id));
    expect(authMocks.getUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("session-state")).toHaveTextContent("active");
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it("coalesces simultaneous unauthorized responses into one validation", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(user.id));

    const recovery = deferred<{ data: { user: typeof user }; error: null }>();
    authMocks.getUser.mockReturnValue(recovery.promise);
    const startupCalls = authMocks.getUser.mock.calls.length;

    act(() => {
      publishUnauthorizedSession();
      publishUnauthorizedSession();
      publishUnauthorizedSession();
    });

    expect(authMocks.getUser).toHaveBeenCalledTimes(startupCalls + 1);
    await act(async () => recovery.resolve({ data: { user }, error: null }));
    expect(screen.getByTestId("identity")).toHaveTextContent(user.id);
    expect(screen.getByTestId("session-state")).toHaveTextContent("active");
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it("expires the local browser after an unauthorized response confirms revocation", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(user.id));
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: "session_not_found", message: "Session not found" },
    });

    act(() => publishUnauthorizedSession());

    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("signed-out"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("expired");
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs out only the current browser without showing an expiry notice", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent(user.id));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByTestId("identity")).toHaveTextContent("signed-out"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("active");
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
