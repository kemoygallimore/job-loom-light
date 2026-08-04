import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import Pipeline from "./Pipeline";
import { renderWithProviders } from "@/test/renderWithProviders";

const state = vi.hoisted(() => ({
  fromCalls: [] as string[],
  profile: { user_id: "user-1", company_id: "company-1", name: "Admin User" },
  jobs: [{ id: "job-1", title: "Digital Marketing Specialist" }],
  pipelineRows: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ values: Record<string, unknown>; column: string; ids: string[] }>,
  updateError: null as { message: string } | null,
}));

const pipelineRow = (id: string, name: string, stage: string) => ({
  id,
  job_id: "job-1",
  candidate_id: `candidate-${id}`,
  stage,
  company_id: "company-1",
  candidate_name: name,
  candidate_email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  job_title: "Digital Marketing Specialist",
  hiring_manager: null,
  screening_score: null,
  screening_status: null,
  review_needed_count: 0,
  interview_average: null,
});

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

vi.mock("@/components/export/ExportRequestDialog", () => ({
  ExportRequestDialog: () => <button type="button">Export</button>,
}));

vi.mock("@/components/pipeline/CandidatePanel", () => ({
  default: () => null,
}));

vi.mock("@/components/email/CandidateEmailComposer", () => ({
  CandidateEmailComposer: () => null,
}));

vi.mock("@/components/candidate/CandidateFormSendDialog", () => ({
  CandidateFormSendDialog: () => null,
}));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  Droppable: ({ children }: { children: (provided: unknown, snapshot: unknown) => ReactNode }) => (
    <>
      {children(
        { innerRef: vi.fn(), droppableProps: {}, placeholder: null },
        { isDraggingOver: false },
      )}
    </>
  ),
  Draggable: ({ children }: { children: (provided: unknown, snapshot: unknown) => ReactNode }) => (
    <>
      {children(
        {
          innerRef: vi.fn(),
          draggableProps: {},
          dragHandleProps: {},
        },
        { isDragging: false },
      )}
    </>
  ),
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => {
        if (table === "jobs") return Promise.resolve({ data: state.jobs, error: null });
        return Promise.resolve({ data: [], error: null });
      }),
    })),
    update: vi.fn((values: Record<string, unknown>) => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      in: vi.fn((column: string, ids: string[]) => {
        state.updates.push({ values, column, ids });
        return Promise.resolve({ data: null, error: state.updateError });
      }),
    })),
  });

  return {
    supabase: {
      rpc: vi.fn(() => Promise.resolve({ data: state.pipelineRows, error: null })),
      from: vi.fn((table: string) => {
        state.fromCalls.push(table);
        return makeQuery(table);
      }),
    },
  };
});

describe("Pipeline manual application creation", () => {
  beforeEach(() => {
    state.fromCalls = [];
    state.pipelineRows = [];
    state.updates = [];
    state.updateError = null;
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    window.localStorage.clear();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("does not expose or load the removed manual application creation flow", async () => {
    renderWithProviders(<Pipeline />);

    expect(screen.queryByRole("button", { name: /new application/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/create application/i)).not.toBeInTheDocument();

    await waitFor(() => expect(state.fromCalls).toContain("jobs"));
    expect(state.fromCalls).not.toContain("candidates");
  });
});

async function openMoveDestination(destination: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "ArrowDown" });
  const moveItem = await screen.findByRole("menuitem", { name: "Move to stage" });
  fireEvent.keyDown(moveItem, { key: "ArrowRight" });
  fireEvent.click(await screen.findByRole("menuitem", { name: destination }));
}

describe("Pipeline batch stage movement", () => {
  beforeEach(() => {
    state.fromCalls = [];
    state.updates = [];
    state.updateError = null;
    state.pipelineRows = [
      pipelineRow("app-1", "Alicia Robinson", "applied"),
      pipelineRow("app-2", "Kimani Anderson", "applied"),
      pipelineRow("app-3", "Jordan Blake", "shortlisted"),
      pipelineRow("app-4", "Sasha Edwards", "rejected"),
    ];
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    window.localStorage.clear();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("locks selection to the first selected source stage until it is cleared", async () => {
    renderWithProviders(<Pipeline />);

    const applied = await screen.findByRole("checkbox", { name: "Select Alicia Robinson" });
    const shortlisted = await screen.findByRole("checkbox", { name: "Select Jordan Blake" });

    fireEvent.click(applied);
    expect(shortlisted).toBeDisabled();

    fireEvent.click(applied);
    expect(shortlisted).toBeEnabled();
  });

  it("confirms and moves selected applications with one batch update", async () => {
    renderWithProviders(<Pipeline />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Alicia Robinson" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Kimani Anderson" }));
    await openMoveDestination("Shortlisted");

    expect(screen.getByRole("heading", { name: "Move 2 candidates to Shortlisted?" })).toBeInTheDocument();
    expect(screen.getByText("This will move the selected candidates from Applied to Shortlisted.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move candidates" }));

    await waitFor(() => expect(state.updates).toEqual([
      { values: { stage: "shortlisted" }, column: "id", ids: ["app-1", "app-2"] },
    ]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Moved 2 candidates to Shortlisted"));
    expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Move 2 candidates to Shortlisted?" })).not.toBeInTheDocument();
  });

  it("keeps selection unchanged when confirmation is cancelled", async () => {
    renderWithProviders(<Pipeline />);

    const applied = await screen.findByRole("checkbox", { name: "Select Alicia Robinson" });
    fireEvent.click(applied);
    await openMoveDestination("Shortlisted");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(applied).toBeChecked();
    expect(state.updates).toEqual([]);
  });

  it("omits the source and rejected stages from batch destinations", async () => {
    renderWithProviders(<Pipeline />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Alicia Robinson" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "ArrowDown" });
    const moveItem = await screen.findByRole("menuitem", { name: "Move to stage" });
    fireEvent.keyDown(moveItem, { key: "ArrowRight" });
    await screen.findByRole("menuitem", { name: "Shortlisted" });

    expect(screen.queryByRole("menuitem", { name: "Applied" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Rejected" })).not.toBeInTheDocument();
  });

  it("does not offer batch movement for rejected selections", async () => {
    renderWithProviders(<Pipeline />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Sasha Edwards" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "ArrowDown" });

    await screen.findByRole("menuitem", { name: "Email Selected" });
    expect(screen.queryByRole("menuitem", { name: "Move to stage" })).not.toBeInTheDocument();
  });

  it("rolls back a failed move and preserves the current selection", async () => {
    state.updateError = { message: "Database unavailable" };
    renderWithProviders(<Pipeline />);

    const applied = await screen.findByRole("checkbox", { name: "Select Alicia Robinson" });
    const shortlisted = await screen.findByRole("checkbox", { name: "Select Jordan Blake" });
    fireEvent.click(applied);
    await openMoveDestination("Shortlisted");
    fireEvent.click(screen.getByRole("button", { name: "Move candidates" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Database unavailable"));
    expect(applied).toBeChecked();
    expect(shortlisted).toBeDisabled();
  });
});
