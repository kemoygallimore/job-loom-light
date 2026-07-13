import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ScreeningReview from "./ScreeningReview";

const choiceId = "fa65b04d-ea16-4211-ab31-a6e7e697a5c0";

const tableResults: Record<string, { data: unknown; error: null }> = {
  job_screening_responses: {
    data: {
      id: "response-1",
      score: 0,
      status: "final",
      review_needed_count: 0,
      submitted_at: "2026-07-12T23:40:26.000Z",
      version_id: "version-1",
    },
    error: null,
  },
  job_screening_answers: {
    data: [
      {
        id: "answer-1",
        question_id: "question-1",
        answer: choiceId,
        answer_display: null,
        rubric_level: null,
        graded_at: null,
        earned_percent: 0,
      },
    ],
    error: null,
  },
  job_screening_questions: {
    data: [
      {
        id: "question-1",
        prompt: "Do you have a Bachelors Degree in ICT",
        position: 1,
        type: "single_choice",
      },
    ],
    error: null,
  },
  job_screening_choices: {
    data: [
      {
        id: choiceId,
        question_id: "question-1",
        label: "No",
        position: 2,
      },
    ],
    error: null,
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => Promise.resolve(tableResults[table]),
        maybeSingle: () => Promise.resolve(tableResults[table]),
        then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
          Promise.resolve(tableResults[table]).then(resolve, reject),
      };
      return builder;
    },
    rpc: vi.fn(),
  },
}));

describe("ScreeningReview", () => {
  it("renders choice labels instead of raw stored choice ids", async () => {
    render(<ScreeningReview applicationId="application-1" />);

    expect(await screen.findByText("No")).toBeInTheDocument();
    expect(screen.queryByText(choiceId)).not.toBeInTheDocument();
  });
});
