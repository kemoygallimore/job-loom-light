import { screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Pipeline from "./Pipeline";
import { renderWithProviders } from "@/test/renderWithProviders";

const state = vi.hoisted(() => ({
  fromCalls: [] as string[],
  profile: { user_id: "user-1", company_id: "company-1", name: "Admin User" },
  jobs: [{ id: "job-1", title: "Digital Marketing Specialist" }],
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
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  });

  return {
    supabase: {
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
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
