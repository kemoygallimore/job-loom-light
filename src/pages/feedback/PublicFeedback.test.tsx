import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicFeedback from "./PublicFeedback";
import { supabase } from "@/integrations/supabase/client";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const link = {
    id: "feedback-link-1",
    company_id: "company-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    application_id: "application-1",
    expires_at: "2026-08-01T00:00:00.000Z",
  };

  const context = {
    ...link,
    candidate_name: "Alicia Brown",
    job_title: "Operations Manager",
    hiring_manager: "Morgan Lee",
  };

  const makeQuery = (table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      limit: vi.fn(() => query),
      order: vi.fn(() => {
        if (table === "interview_scorecard_areas") {
          return Promise.resolve({
            data: [
              { id: "technical", label: "Technical", description: null },
              { id: "communication", label: "Communication", description: null },
            ],
            error: null,
          });
        }
        return query;
      }),
      maybeSingle: vi.fn(() => {
        if (table === "feedback_links") return Promise.resolve({ data: link, error: null });
        if (table === "candidates") return Promise.resolve({ data: null, error: null });
        if (table === "jobs") return Promise.resolve({ data: { title: "Operations Manager", hiring_manager: "Morgan Lee" }, error: null });
        if (table === "interview_scorecard_versions") return Promise.resolve({ data: { id: "scorecard-version-1" }, error: null });
        return Promise.resolve({ data: null, error: null });
      }),
    };
    return query;
  };

  const rpc = vi.fn((name: string) => {
    if (name === "get_public_feedback_context") {
      return {
        maybeSingle: vi.fn(() => Promise.resolve({ data: context, error: null })),
      };
    }
    if (name === "is_feature_enabled") {
      return Promise.resolve({ data: true, error: null });
    }
    if (name === "submit_public_feedback") {
      return Promise.resolve({ data: "feedback-1", error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  return {
    supabase: {
      from: vi.fn((table: string) => makeQuery(table)),
      rpc,
    },
  };
});

function renderPublicFeedback() {
  return render(
    <MemoryRouter initialEntries={["/feedback/token-1"]}>
      <Routes>
        <Route path="/feedback/:token" element={<PublicFeedback />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("shows the candidate name from the public feedback context and submits without consent", async () => {
    renderPublicFeedback();

    expect(await screen.findByText("Alicia Brown")).toBeInTheDocument();
    expect(screen.queryByText(/please review these policies/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/feedback done by/i), { target: { value: "Jordan Panelist" } });
    fireEvent.click(screen.getAllByLabelText("5 stars")[0]);
    fireEvent.click(screen.getAllByLabelText("5 stars")[1]);
    fireEvent.change(screen.getByLabelText(/written summary/i), {
      target: { value: "Strong interview with clear examples." },
    });

    const submit = screen.getByRole("button", { name: /submit feedback/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "submit_public_feedback",
        expect.not.objectContaining({ _consents: expect.anything() }),
      );
    });
  });
});
