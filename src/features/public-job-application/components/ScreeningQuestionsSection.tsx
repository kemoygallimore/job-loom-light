import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/integrations/supabase/types";
import type { ScreeningQuestion } from "@/lib/jobScreening";
import type { FormErrors } from "../types";

interface ScreeningQuestionsSectionProps {
  questions: ScreeningQuestion[];
  answers: Record<string, Json>;
  errors: FormErrors;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, Json>>>;
}

export function ScreeningQuestionsSection({
  questions,
  answers,
  errors,
  setAnswers,
}: ScreeningQuestionsSectionProps) {
  if (questions.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div><h2 className="font-semibold">Screening questions</h2><p className="text-xs text-muted-foreground">Your answers help the hiring team review this application.</p></div>
      {questions.map((question, index) => <div key={question.id} className="space-y-2">
        <Label>{index + 1}. {question.prompt}{question.required ? " *" : ""}</Label>
        {(question.type === "short_text" || question.type === "long_text") && <Textarea rows={question.type === "long_text" ? 5 : 2} value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />}
        {question.type === "number" && <Input type="number" value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: Number(event.target.value) }))} />}
        {(question.type === "yes_no" || question.type === "single_choice") && <Select value={String(answers[question.id] ?? "")} onValueChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}><SelectTrigger><SelectValue placeholder="Select an answer" /></SelectTrigger><SelectContent>{question.choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>)}</SelectContent></Select>}
        {question.type === "multi_select" && <div className="space-y-2">{question.choices.map((choice) => { const selected = Array.isArray(answers[question.id]) ? answers[question.id] as Json[] : []; return <label key={choice.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><Checkbox checked={selected.includes(choice.id)} onCheckedChange={(checked) => setAnswers((current) => ({ ...current, [question.id]: checked ? [...selected, choice.id] : selected.filter((value) => value !== choice.id) }))} />{choice.label}</label>; })}</div>}
        {errors[`screening-${question.id}`] && <p className="text-xs text-destructive">{errors[`screening-${question.id}`]}</p>}
      </div>)}
    </section>
  );
}
