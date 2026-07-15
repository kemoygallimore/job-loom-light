import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormBuilder from "./FormBuilder";
import FormSubmissions from "./FormSubmissions";
import Forms from "../Forms";
import { defaultLeadFormSchema, LeadForm } from "@/lib/leadForms";

const companyId = "company_1";
const formId = "form_1";

const mockForm: LeadForm = {
  id: formId,
  company_id: companyId,
  created_by: "user_1",
  title: "QA Intake Form",
  description: "Route regression form",
  status: "active",
  public_id: "public_1",
  schema: defaultLeadFormSchema,
  created_at: "2026-07-05T10:00:00.000Z",
  updated_at: "2026-07-05T10:00:00.000Z",
  deleted_at: null,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user_1", email: "qa@example.com" },
    profile: { company_id: companyId },
    loading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const query = {
      select: vi.fn(() => query),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      order: vi.fn(() => {
        if (table === "lead_forms") return Promise.resolve({ data: [mockForm], error: null });
        return Promise.resolve({ data: [], error: null });
      }),
      maybeSingle: vi.fn(() => {
        if (table === "lead_forms") return Promise.resolve({ data: mockForm, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      then: undefined,
    };
    return query;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => makeQuery(table)),
    },
  };
});

function renderFormRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/forms/:publicId" element={<div>Public respondent form</div>} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/forms/new" element={<FormBuilder />} />
        <Route path="/forms/:formId/edit" element={<FormBuilder />} />
        <Route path="/forms/:formId/submissions" element={<FormSubmissions />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("form route rendering", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the new-form builder without the public form route", async () => {
    renderFormRoutes("/forms/new");

    expect(await screen.findByRole("heading", { name: /build form/i })).toBeInTheDocument();
    expect(screen.queryByText("Public respondent form")).not.toBeInTheDocument();
  });

  it("keeps form builder sidebars sticky on desktop", async () => {
    renderFormRoutes("/forms/new");

    expect(await screen.findByRole("heading", { name: /build form/i })).toBeInTheDocument();

    const palette = screen.getByRole("complementary", { name: /field palette/i });
    const settings = screen.getByRole("complementary", { name: /field settings/i });

    expect(palette).toHaveClass("xl:sticky", "xl:top-0", "xl:self-start", "xl:max-h-[calc(100vh-4rem)]");
    expect(settings).toHaveClass(
      "xl:sticky",
      "xl:top-0",
      "xl:self-start",
      "xl:max-h-[calc(100vh-4rem)]",
      "xl:overflow-y-auto",
    );
  });

  it("renders edit form slugs through the protected builder route", async () => {
    renderFormRoutes(`/forms/${formId}/edit`);

    expect(await screen.findByRole("heading", { name: /edit form/i })).toBeInTheDocument();
    expect(screen.queryByText("Public respondent form")).not.toBeInTheDocument();
  });

  it("renders submission slugs through the protected submissions route", async () => {
    renderFormRoutes(`/forms/${formId}/submissions`);

    expect(await screen.findByRole("heading", { name: mockForm.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
    expect(screen.queryByText("Public respondent form")).not.toBeInTheDocument();
  });

  it("renders the forms list after returning from builder routes", async () => {
    const { rerender } = renderFormRoutes("/forms/new");
    expect(await screen.findByRole("heading", { name: /build form/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter key="forms-list" initialEntries={["/forms"]}>
        <Routes>
          <Route path="/forms/:publicId" element={<div>Public respondent form</div>} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/forms/new" element={<FormBuilder />} />
          <Route path="/forms/:formId/edit" element={<FormBuilder />} />
          <Route path="/forms/:formId/submissions" element={<FormSubmissions />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: /^forms$/i })).toBeInTheDocument());
    expect(await screen.findByText(mockForm.title)).toBeInTheDocument();
  });
});
