import type { Json } from "@/integrations/supabase/types";

export type ScreeningQuestionType =
  | "yes_no"
  | "single_choice"
  | "multi_select"
  | "number"
  | "short_text"
  | "long_text";

export interface ScreeningChoice {
  id: string;
  label: string;
  credit_percent: number;
  position: number;
}

export interface ScreeningQuestion {
  id: string;
  version_id: string;
  prompt: string;
  type: ScreeningQuestionType;
  required: boolean;
  position: number;
  settings: Json;
  rubric: Json | null;
  choices: ScreeningChoice[];
}

export const WRITTEN_TYPES = new Set<ScreeningQuestionType>(["short_text", "long_text"]);

export function objectiveCredit(question: ScreeningQuestion, value: Json): number | null {
  if (WRITTEN_TYPES.has(question.type)) return null;
  if (question.type === "multi_select") {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    if (selected.size === 0) return 0;
    const credits = question.choices.filter((choice) => selected.has(choice.id)).map((choice) => choice.credit_percent);
    return credits.length ? Math.min(100, credits.reduce((sum, credit) => sum + credit, 0)) : 0;
  }
  const choice = question.choices.find((item) => item.id === String(value));
  if (choice) return choice.credit_percent;
  const settings = (question.settings ?? {}) as Record<string, Json | undefined>;
  if (question.type === "number") {
    const numberValue = Number(value);
    const min = typeof settings.min === "number" ? settings.min : Number.NEGATIVE_INFINITY;
    const max = typeof settings.max === "number" ? settings.max : Number.POSITIVE_INFINITY;
    return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max ? 100 : 0;
  }
  return 0;
}

export function calculateScreeningScore(
  questions: ScreeningQuestion[],
  answers: Record<string, Json>,
) {
  if (!questions.length) return { score: 0, reviewNeededCount: 0, status: "final" as const };
  let totalPercent = 0;
  let reviewNeededCount = 0;
  for (const question of questions) {
    const credit = objectiveCredit(question, answers[question.id]);
    if (credit === null) reviewNeededCount += 1;
    else totalPercent += credit;
  }
  return {
    score: Number((totalPercent / questions.length).toFixed(2)),
    reviewNeededCount,
    status: reviewNeededCount ? ("provisional" as const) : ("final" as const),
  };
}

export const RUBRIC_PERCENTAGES = [0, 25, 50, 75, 100] as const;

