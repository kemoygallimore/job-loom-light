import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/functionErrors";
import Auth from "./Auth";

const authState = vi.hoisted(() => ({
  sessionExpired: true,
  clearSessionExpired: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    sessionExpired: authState.sessionExpired,
    clearSessionExpired: authState.clearSessionExpired,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: authState.signInWithPassword,
    },
  },
}));

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={["/auth"]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<div>Signed in</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.sessionExpired = true;
  authState.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("Auth session recovery", () => {
  it("shows plain-language guidance when the previous session expired", () => {
    renderAuth();

    expect(screen.getByRole("alert")).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
  });

  it("clears the expiry notice after a successful sign-in", async () => {
    renderAuth();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(authState.clearSessionExpired).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Signed in")).toBeInTheDocument();
  });
});
