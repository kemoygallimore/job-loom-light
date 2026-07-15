import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    profile: { company_id: "company_1", email: "admin@example.com", name: "Admin User" },
    role: "admin",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ flags: { assessment: false } }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data: { status: "active" }, error: null })),
  };

  return {
    supabase: {
      from: vi.fn(() => query),
    },
  };
});

function renderLayout(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/forms" element={<div>Forms list</div>} />
          <Route path="/forms/new" element={<div>Form builder</div>} />
          <Route path="/forms/:formId/edit" element={<div>Edit form builder</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  it("lets form builder routes use page scroll for sticky sidebars", async () => {
    renderLayout("/forms/new");

    const main = screen.getByRole("main");
    await waitFor(() => expect(main).toHaveClass("overflow-visible"));
    expect(main).not.toHaveClass("overflow-auto");
  });

  it("keeps the default internal page scroll on non-builder routes", async () => {
    renderLayout("/forms");

    const main = screen.getByRole("main");
    await waitFor(() => expect(main).toHaveClass("overflow-auto"));
    expect(main).not.toHaveClass("overflow-visible");
  });
});
