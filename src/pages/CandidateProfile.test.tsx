import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CandidateProfile from "./CandidateProfile";

const state = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; payload: Record<string, unknown>; filters: Record<string, unknown> }>,
  profile: { user_id: "user-1", company_id: "company-1", name: "Admin User" },
  candidate: {
    id: "candidate-1",
    name: "Lisa Kemmer",
    email: "lisa@example.com",
    phone: null,
    resume_url: null,
    resume_bucket: null,
    resume_object_key: null,
    created_at: "2026-07-01T10:00:00.000Z",
    company_id: "company-1",
    country: null,
    street_address: null,
    parish_state: null,
    education_level: null,
    linkedin_url: null,
  },
  applications: [
    {
      id: "application-1",
      stage: "applied",
      updated_at: "2026-07-02T10:00:00.000Z",
      created_at: "2026-07-02T10:00:00.000Z",
      job_id: "job-1",
      jobs: { title: "Digital Marketing Specialist", hiring_manager: null },
    },
    {
      id: "application-2",
      stage: "shortlisted",
      updated_at: "2026-07-01T10:00:00.000Z",
      created_at: "2026-07-01T10:00:00.000Z",
      job_id: "job-2",
      jobs: { title: "Sales Coordinator", hiring_manager: null },
    },
  ],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    profile: state.profile,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/candidate/CandidateNotes", () => ({
  default: () => <div>Notes mock</div>,
}));

vi.mock("@/components/candidate/ActivityTimeline", () => ({
  default: () => <div>Timeline mock</div>,
}));

vi.mock("@/components/candidate/InterviewFeedback", () => ({
  default: () => <div>Feedback mock</div>,
}));

vi.mock("@/components/candidate/ResumeHistory", () => ({
  default: () => <div>Resume mock</div>,
}));

vi.mock("@/components/candidate/CandidateTagsBar", () => ({
  default: () => <div>Tags mock</div>,
}));

vi.mock("@/components/candidate/CandidateDocuments", () => ({
  default: () => <div>Documents mock</div>,
}));

vi.mock("@/lib/r2Worker", () => ({
  R2_BUCKET_RESUMES: "silverweb-ats-resumes",
  getSignedR2Url: vi.fn(),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select aria-label="Application stage" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@/components/email/CandidateEmailComposer", () => ({
  CandidateEmailComposer: ({
    open,
    mode,
    recipients,
    onOpenChange,
    onSent,
  }: {
    open: boolean;
    mode?: string;
    recipients: Array<{ applicationId?: string | null }>;
    onOpenChange: (open: boolean) => void;
    onSent?: (ids: string[]) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={mode === "rejection" ? "Review rejection email" : "Candidate email"}>
        <div>Composer application: {recipients[0]?.applicationId}</div>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel composer
        </button>
        <button
          type="button"
          onClick={() => onSent?.(recipients.map((recipient) => recipient.applicationId).filter(Boolean) as string[])}
        >
          Send composer
        </button>
      </div>
    ) : null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const filters: Record<string, unknown> = {};

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return query;
      }),
      in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      order: vi.fn(() => {
        if (table === "applications") return Promise.resolve({ data: state.applications, error: null });
        if (table === "notes" || table === "email_send_log") return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      }),
      single: vi.fn(() => {
        if (table === "candidates") return Promise.resolve({ data: state.candidate, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        const updateFilters: Record<string, unknown> = {};
        return {
          eq: vi.fn((column: string, value: unknown) => {
            updateFilters[column] = value;
            state.updates.push({ table, payload, filters: { ...updateFilters } });
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };

    return query;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => makeQuery(table)),
    },
  };
});

function renderCandidateProfile() {
  return render(
    <MemoryRouter initialEntries={["/candidates/candidate-1"]}>
      <Routes>
        <Route path="/candidates/:id" element={<CandidateProfile />} />
        <Route path="/candidates" element={<div>Candidates list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CandidateProfile rejection flow", () => {
  beforeEach(() => {
    state.updates = [];
  });

  it("opens the rejection composer instead of immediately updating the application", async () => {
    renderCandidateProfile();

    const stageSelects = await screen.findAllByRole("combobox", { name: "Application stage" });
    fireEvent.change(stageSelects[1], { target: { value: "rejected" } });

    expect(await screen.findByRole("dialog", { name: "Review rejection email" })).toBeInTheDocument();
    expect(screen.getByText("Composer application: application-2")).toBeInTheDocument();
    expect(state.updates).toHaveLength(0);
    expect(stageSelects[1]).toHaveValue("shortlisted");
  });

  it("leaves the stage unchanged when the rejection composer is cancelled", async () => {
    renderCandidateProfile();

    const stageSelects = await screen.findAllByRole("combobox", { name: "Application stage" });
    fireEvent.change(stageSelects[1], { target: { value: "rejected" } });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel composer" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review rejection email" })).not.toBeInTheDocument());
    expect(stageSelects[1]).toHaveValue("shortlisted");
  });

  it("marks only the selected application as rejected after the rejection email sends", async () => {
    renderCandidateProfile();

    const stageSelects = await screen.findAllByRole("combobox", { name: "Application stage" });
    fireEvent.change(stageSelects[1], { target: { value: "rejected" } });
    fireEvent.click(await screen.findByRole("button", { name: "Send composer" }));

    await waitFor(() => expect(stageSelects[1]).toHaveValue("rejected"));
    expect(stageSelects[0]).toHaveValue("applied");
  });
});
