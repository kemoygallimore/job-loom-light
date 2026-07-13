import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import KanbanCard from "./KanbanCard";
import type { Application } from "@/pages/Pipeline";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [] }),
      }),
    }),
  },
}));

const application = (patch: Partial<Application> = {}): Application => ({
  id: "application-1",
  job_id: "job-1",
  candidate_id: "candidate-1",
  stage: "applied",
  company_id: "company-1",
  candidate: { name: "Alicia Robinson", email: "alicia@example.com" },
  job: { title: "Frontend Developer", hiring_manager: null, status: "open" },
  screening_score: 84,
  screening_status: "provisional",
  review_needed_count: 1,
  interview_average: null,
  ...patch,
});

describe("KanbanCard screening score", () => {
  it("shows only the overall score and neutral status on the pipeline card", async () => {
    render(<KanbanCard app={application()} isDragging={false} />);

    await waitFor(() => expect(screen.getByText("Screening 84/100")).toBeInTheDocument());
    expect(screen.getByText("Provisional")).toBeInTheDocument();
    expect(screen.getByText("Review needed")).toBeInTheDocument();
    expect(screen.queryByText(/answer/i)).not.toBeInTheDocument();
  });
});
