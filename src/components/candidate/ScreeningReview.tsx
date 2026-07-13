import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { answerPreview } from "@/lib/leadForms";

interface Props {
  applicationId: string;
}

interface ScreeningResponse {
  id: string;
  score: number;
  status: string;
  review_needed_count: number;
  submitted_at: string;
  version_id: string;
}

interface Answer {
  id: string;
  question_id: string;
  answer: unknown;
  answer_display: unknown | null;
  rubric_level: number | null;
  graded_at: string | null;
  earned_percent: number | null;
}

interface Choice {
  id: string;
  question_id: string;
  label: string;
  position: number;
}

interface Question {
  id: string;
  prompt: string;
  position: number;
  type: "yes_no" | "single_choice" | "multi_select" | "number" | "short_text" | "long_text";
  choices: Choice[];
}

interface MissingContext {
  hasActiveScreening: boolean;
  applicationPredatesActiveScreening: boolean;
}

function unknownChoicePreview(value: unknown) {
  const text = answerPreview(value);
  return text === "-" ? text : `Unknown choice (${text})`;
}

function screeningAnswerPreview(answer: Answer, question?: Question) {
  if (answer.answer_display != null) return answerPreview(answer.answer_display);
  if (!question) return answerPreview(answer.answer);

  const choicesById = new Map(question.choices.map((choice) => [choice.id, choice.label]));

  if (question.type === "yes_no" || question.type === "single_choice") {
    const choiceId = String(answer.answer ?? "");
    return choicesById.get(choiceId) ?? unknownChoicePreview(answer.answer);
  }

  if (question.type === "multi_select") {
    if (!Array.isArray(answer.answer)) return answerPreview(answer.answer);
    return answerPreview(
      answer.answer.map((choiceId) => choicesById.get(String(choiceId)) ?? unknownChoicePreview(choiceId)),
    );
  }

  return answerPreview(answer.answer);
}

export default function ScreeningReview({ applicationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<ScreeningResponse | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questionsById, setQuestionsById] = useState<Record<string, Question>>({});
  const [missingContext, setMissingContext] = useState<MissingContext>({
    hasActiveScreening: false,
    applicationPredatesActiveScreening: false,
  });

  const loadMissingContext = useCallback(async () => {
    const { data: application } = await supabase
      .from("applications")
      .select("created_at, job_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (!application) {
      setMissingContext({ hasActiveScreening: false, applicationPredatesActiveScreening: false });
      return;
    }

    const { data: activeVersion } = await supabase
      .from("job_screening_versions")
      .select("id, created_at, published_at")
      .eq("job_id", application.job_id)
      .in("status", ["published", "locked"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeVersion) {
      setMissingContext({ hasActiveScreening: false, applicationPredatesActiveScreening: false });
      return;
    }

    const { count } = await supabase
      .from("job_screening_questions")
      .select("id", { count: "exact", head: true })
      .eq("version_id", activeVersion.id);

    const activeFrom = activeVersion.published_at ?? activeVersion.created_at;
    setMissingContext({
      hasActiveScreening: Boolean(count && count > 0),
      applicationPredatesActiveScreening: new Date(application.created_at).getTime() < new Date(activeFrom).getTime(),
    });
  }, [applicationId]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: row, error: responseError } = await supabase
      .from("job_screening_responses")
      .select("id, score, status, review_needed_count, submitted_at, version_id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (responseError) {
      toast.error(responseError.message);
      setLoading(false);
      return;
    }

    setResponse(row as ScreeningResponse | null);

    if (!row) {
      setAnswers([]);
      setQuestionsById({});
      await loadMissingContext();
      setLoading(false);
      return;
    }

    const [{ data: answerRows, error: answersError }, { data: questionRows, error: questionsError }] =
      await Promise.all([
        supabase
          .from("job_screening_answers")
          .select("id, question_id, answer, answer_display, rubric_level, graded_at, earned_percent")
          .eq("response_id", row.id),
        supabase
          .from("job_screening_questions")
          .select("id, prompt, position, type")
          .eq("version_id", row.version_id)
          .order("position"),
      ]);

    if (answersError || questionsError) {
      toast.error(answersError?.message ?? questionsError?.message ?? "Could not load screening answers");
      setLoading(false);
      return;
    }

    const orderedQuestionBase = (questionRows ?? []) as Omit<Question, "choices">[];
    const questionIds = orderedQuestionBase.map((question) => question.id);
    const { data: choiceRows, error: choicesError } = questionIds.length
      ? await supabase
          .from("job_screening_choices")
          .select("id, question_id, label, position")
          .in("question_id", questionIds)
          .order("position")
      : { data: [], error: null };

    if (choicesError) {
      toast.error(choicesError.message);
      setLoading(false);
      return;
    }

    const choicesByQuestion = new Map<string, Choice[]>();
    for (const choice of (choiceRows ?? []) as Choice[]) {
      const existing = choicesByQuestion.get(choice.question_id) ?? [];
      existing.push(choice);
      choicesByQuestion.set(choice.question_id, existing);
    }

    const orderedQuestions = orderedQuestionBase.map((question) => ({
      ...question,
      choices: choicesByQuestion.get(question.id) ?? [],
    }));
    const questionOrder = new Map(orderedQuestions.map((question, index) => [question.id, index]));
    setAnswers(
      ((answerRows ?? []) as Answer[]).sort(
        (left, right) => (questionOrder.get(left.question_id) ?? 0) - (questionOrder.get(right.question_id) ?? 0),
      ),
    );
    setQuestionsById(Object.fromEntries(orderedQuestions.map((question) => [question.id, question])));
    setLoading(false);
  }, [applicationId, loadMissingContext]);

  useEffect(() => {
    load();
  }, [load]);

  const grade = async (answerId: string, level: number) => {
    if (!window.confirm(`Lock this written answer at ${level}/5? This grade cannot be changed.`)) return;
    const { error } = await supabase.rpc("grade_written_screening_answer", {
      _answer_id: answerId,
      _rubric_level: level,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Written answer graded and locked");
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No screening submitted for this application.</p>
        {missingContext.hasActiveScreening && missingContext.applicationPredatesActiveScreening ? (
          <p className="mt-2">
            This application was submitted before active screening questions were available for this job.
          </p>
        ) : missingContext.hasActiveScreening ? (
          <p className="mt-2">This application does not have a captured screening response.</p>
        ) : (
          <p className="mt-2">This job does not currently have active screening questions.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Screening score</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(response.score)}/100</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {new Date(response.submitted_at).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="secondary" className="capitalize">
            {response.status}
          </Badge>
          {response.review_needed_count > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {response.review_needed_count} written answer{response.review_needed_count === 1 ? "" : "s"} to review
            </p>
          ) : null}
        </div>
      </div>

      {answers.map((answer, index) => (
        <article key={answer.id} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            {index + 1}. {questionsById[answer.question_id]?.prompt ?? "Screening question"}
          </p>
          <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
            {screeningAnswerPreview(answer, questionsById[answer.question_id])}
          </p>
          {answer.earned_percent == null && !answer.graded_at ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Select once to permanently grade this response
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Button key={level} variant="outline" size="sm" onClick={() => grade(answer.id, level)}>
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Locked grade: {answer.rubric_level ? `${answer.rubric_level}/5` : `${answer.earned_percent}% credit`}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
