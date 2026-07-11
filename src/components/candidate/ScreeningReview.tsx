import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { answerPreview } from "@/lib/leadForms";

interface Props { applicationId: string }
interface Answer { id: string; question_id: string; answer: unknown; rubric_level: number | null; graded_at: string | null; earned_percent: number | null }

export default function ScreeningReview({ applicationId }: Props) {
  const [response, setResponse] = useState<{ id: string; score: number; status: string; review_needed_count: number; version_id: string } | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]); const [prompts, setPrompts] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data: row } = await supabase.from("job_screening_responses").select("id, score, status, review_needed_count, version_id").eq("application_id", applicationId).maybeSingle();
    setResponse(row); if (!row) return;
    const [{ data: answerRows }, { data: questionRows }] = await Promise.all([
      supabase.from("job_screening_answers").select("id, question_id, answer, rubric_level, graded_at, earned_percent").eq("response_id", row.id),
      supabase.from("job_screening_questions").select("id, prompt").eq("version_id", row.version_id),
    ]);
    setAnswers((answerRows ?? []) as Answer[]); setPrompts(Object.fromEntries((questionRows ?? []).map((question) => [question.id, question.prompt])));
  }, [applicationId]);
  useEffect(() => { load(); }, [load]);
  const grade = async (answerId: string, level: number) => {
    if (!window.confirm(`Lock this written answer at ${level}/5? This grade cannot be changed.`)) return;
    const { error } = await supabase.rpc("grade_written_screening_answer", { _answer_id: answerId, _rubric_level: level });
    if (error) toast.error(error.message); else { toast.success("Written answer graded and locked"); await load(); }
  };
  if (!response) return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No scored screening response for this application.</div>;
  return <div className="space-y-4"><div className="flex items-center justify-between rounded-lg border p-4"><div><p className="text-sm text-muted-foreground">Screening score</p><p className="text-2xl font-semibold tabular-nums">{Math.round(response.score)}/100</p></div><div className="text-right"><Badge variant="secondary" className="capitalize">{response.status}</Badge>{response.review_needed_count > 0 && <p className="mt-1 text-xs text-muted-foreground">{response.review_needed_count} written answer{response.review_needed_count === 1 ? "" : "s"} to review</p>}</div></div>{answers.map((answer, index) => <article key={answer.id} className="rounded-lg border p-4 space-y-3"><p className="text-sm font-medium">{index + 1}. {prompts[answer.question_id] ?? "Screening question"}</p><p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{answerPreview(answer.answer)}</p>{answer.earned_percent == null && !answer.graded_at ? <div><p className="mb-2 text-xs font-medium text-muted-foreground">Select once to permanently grade this response</p><div className="flex gap-2">{[1, 2, 3, 4, 5].map((level) => <Button key={level} variant="outline" size="sm" onClick={() => grade(answer.id, level)}>{level}</Button>)}</div></div> : <p className="text-xs text-muted-foreground">Locked grade: {answer.rubric_level ? `${answer.rubric_level}/5` : `${answer.earned_percent}% credit`}</p>}</article>)}</div>;
}
