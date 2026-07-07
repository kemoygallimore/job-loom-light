import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompanyEmailTemplates from "./CompanyEmailTemplates";
import { CandidateEmailTemplate, REJECTION_TEMPLATE_KEY } from "@/lib/candidateEmailTemplates";

const companyId = "company-1";

const state = vi.hoisted(() => ({
  templateRows: [] as CandidateEmailTemplate[],
  insertPayloads: [] as Record<string, unknown>[],
  updatePayloads: [] as Array<{ payload: Record<string, unknown>; filters: Record<string, unknown> }>,
}));

const uuid = (value: string) => value as ReturnType<Crypto["randomUUID"]>;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "qa@example.com" },
    profile: { company_id: companyId, user_id: "user-1" },
    loading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Email body editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/integrations/supabase/client", () => {
  const applyCompanyEmailFilters = (filters: Record<string, unknown>) =>
    state.templateRows.filter((template) => {
      if (filters.company_id && template.company_id !== filters.company_id) return false;
      if ("archived_at" in filters && filters.archived_at === null && template.archived_at !== null) return false;
      if (filters.id && template.id !== filters.id) return false;
      return true;
    });

  const makeQuery = (table: string) => {
    const filters: Record<string, unknown> = {};
    let mutationPayload: Record<string, unknown> = {};

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return query;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return query;
      }),
      order: vi.fn(() => query),
      insert: vi.fn((payload: Record<string, unknown>) => {
        mutationPayload = payload;
        return query;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        mutationPayload = payload;
        return query;
      }),
      in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => {
        if (table === "companies") return Promise.resolve({ data: { name: "RizonHire" }, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      single: vi.fn(() => {
        if (table !== "company_email_templates") return Promise.resolve({ data: null, error: null });

        if (filters.id) {
          state.updatePayloads.push({ payload: mutationPayload, filters: { ...filters } });
          const current = state.templateRows.find((template) => template.id === filters.id);
          const updated = { ...current, ...mutationPayload, id: filters.id } as CandidateEmailTemplate;
          state.templateRows = state.templateRows.map((template) =>
            template.id === filters.id ? updated : template,
          );
          return Promise.resolve({ data: updated, error: null });
        }

        state.insertPayloads.push(mutationPayload);
        if (
          state.templateRows.some(
            (template) => template.company_id === mutationPayload.company_id && template.key === mutationPayload.key,
          )
        ) {
          return Promise.resolve({
            data: null,
            error: {
              message:
                'duplicate key value violates unique constraint "company_email_templates_company_key_unique"',
            },
          });
        }

        const inserted = { ...mutationPayload, id: "created-template" } as CandidateEmailTemplate;
        state.templateRows = [inserted, ...state.templateRows];
        return Promise.resolve({ data: inserted, error: null });
      }),
      then: (resolve: (value: { data: unknown; error: null }) => void, reject: (reason?: unknown) => void) => {
        const data =
          table === "company_email_templates"
            ? applyCompanyEmailFilters(filters)
            : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };

    return query;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => makeQuery(table)),
    },
  };
});

function template(overrides: Partial<CandidateEmailTemplate>): CandidateEmailTemplate {
  return {
    id: "template-1",
    company_id: companyId,
    key: "candidate_email_existing",
    name: "Existing Template",
    purpose: "general",
    is_default_for_purpose: false,
    subject: "Existing subject",
    html_body: "<p>Existing body</p>",
    text_body: null,
    variables: ["candidate_name", "company_name", "job_title"],
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

function seedTemplates() {
  state.templateRows = [
    template({
      id: "rejection-template",
      key: REJECTION_TEMPLATE_KEY,
      name: "Candidate Rejected",
      purpose: "rejection",
      is_default_for_purpose: true,
      subject: "Unfortunately, we are not moving forward",
      html_body: "<p>Rejection body</p>",
    }),
    template({
      id: "inactive-template",
      key: "candidate_email_inactive",
      name: "Inactive Follow Up",
      subject: "Follow up",
      html_body: "<p>Inactive body</p>",
      is_active: false,
    }),
    template({
      id: "duplicate-key-template",
      key: "candidate_email_duplicate",
      name: "Duplicate Key Template",
    }),
    template({
      id: "archived-template",
      key: "candidate_email_archived",
      name: "Archived Template",
      archived_at: "2026-07-01T10:00:00.000Z",
    }),
  ];
}

describe("CompanyEmailTemplates", () => {
  beforeEach(() => {
    state.insertPayloads = [];
    state.updatePayloads = [];
    seedTemplates();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows active and inactive non-archived templates grouped in the library", async () => {
    render(<CompanyEmailTemplates />);

    expect(await screen.findByText("Candidate Rejected")).toBeInTheDocument();
    expect(screen.getByText("Inactive Follow Up")).toBeInTheDocument();
    expect(screen.queryByText("Archived Template")).not.toBeInTheDocument();
    expect(screen.getByText("3 visible templates")).toBeInTheDocument();
  });

  it("starts a true new template after selecting the rejection template", async () => {
    render(<CompanyEmailTemplates />);

    fireEvent.click(await screen.findByText("Candidate Rejected"));
    fireEvent.click(screen.getByRole("button", { name: /new template/i }));

    expect(screen.getByLabelText("Template name")).toHaveValue("New Candidate Email");
    expect(screen.getByLabelText("Subject")).toHaveValue("Update from {{company_name}}");
    expect(screen.getByLabelText("Email body editor")).not.toHaveValue("<p>Rejection body</p>");

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(state.insertPayloads).toHaveLength(1));
    expect(state.updatePayloads).toHaveLength(0);
    expect(state.insertPayloads[0].key).toMatch(/^candidate_email_/);
    expect(state.insertPayloads[0].key).not.toBe(REJECTION_TEMPLATE_KEY);
    expect(state.insertPayloads[0].subject).toBe("Update from {{company_name}}");
  });

  it("generates a fresh insert key at save time and retries once on duplicate keys", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(uuid("draft-key"))
      .mockReturnValueOnce(uuid("duplicate"))
      .mockReturnValueOnce(uuid("fresh-key"));

    render(<CompanyEmailTemplates />);

    fireEvent.click(await screen.findByRole("button", { name: /new template/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(state.insertPayloads).toHaveLength(2));
    expect(state.insertPayloads[0].key).toBe("candidate_email_duplicate");
    expect(state.insertPayloads[1].key).toBe("candidate_email_fresh-key");
  });

  it("updates an existing template when editing instead of inserting", async () => {
    render(<CompanyEmailTemplates />);

    fireEvent.click(await screen.findByText("Inactive Follow Up"));
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Renamed Follow Up" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(state.updatePayloads).toHaveLength(1));
    expect(state.insertPayloads).toHaveLength(0);
    expect(state.updatePayloads[0].filters.id).toBe("inactive-template");
    expect(state.updatePayloads[0].payload.name).toBe("Renamed Follow Up");
  });
});
