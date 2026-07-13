import { describe, expect, it } from "vitest";
import { calculateScreeningScore, objectiveCredit, type ScreeningQuestion } from "./jobScreening";

const question = (patch: Partial<ScreeningQuestion>): ScreeningQuestion => ({
  id: "q1", version_id: "v1", prompt: "Question", type: "single_choice", required: true,
  position: 0, settings: {}, rubric: null,
  choices: [{ id: "best", label: "Best", credit_percent: 100, position: 0 }, { id: "ok", label: "OK", credit_percent: 50, position: 1 }],
  ...patch,
});

describe("job screening scoring", () => {
  it("applies per-answer partial credit", () => {
    expect(objectiveCredit(question({}), "ok")).toBe(50);
  });

  it("uses equal question weights and marks written answers provisional", () => {
    const result = calculateScreeningScore(
      [question({}), question({ id: "q2", type: "short_text", choices: [], rubric: { 1: "Poor", 5: "Excellent" } })],
      { q1: "best", q2: "A thoughtful answer" },
    );
    expect(result).toEqual({ score: 50, reviewNeededCount: 1, status: "provisional" });
  });
});
