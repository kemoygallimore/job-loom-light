import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScreeningQuestionType } from "@/lib/jobScreening";

export interface DraftChoice {
  id: string;
  label: string;
  credit_percent: number;
}

export interface DraftQuestion {
  id: string;
  prompt: string;
  type: ScreeningQuestionType;
  choices: DraftChoice[];
  rubric: Record<string, string> | null;
}

export type ScreeningEditorStatus = "draft" | "published" | "locked";

interface Props {
  questions: DraftQuestion[];
  status: ScreeningEditorStatus;
  version: number;
  onQuestionsChange: (questions: DraftQuestion[]) => void;
}

const typeLabels: Record<ScreeningQuestionType, string> = {
  yes_no: "Yes / No",
  single_choice: "Single choice",
  multi_select: "Multiple select",
  number: "Number",
  short_text: "Short written answer",
  long_text: "Long written answer",
};

const choiceTypes = new Set<ScreeningQuestionType>(["yes_no", "single_choice", "multi_select"]);
const writtenTypes = new Set<ScreeningQuestionType>(["short_text", "long_text"]);
const defaultRubric = {
  "1": "Does not meet expectations",
  "2": "Below expectations",
  "3": "Meets expectations",
  "4": "Above expectations",
  "5": "Exceptional",
};

export function createDraftQuestion(type: ScreeningQuestionType = "yes_no"): DraftQuestion {
  const yesNo = type === "yes_no";

  return {
    id: crypto.randomUUID(),
    prompt: "",
    type,
    choices: yesNo
      ? [
          { id: crypto.randomUUID(), label: "Yes", credit_percent: 100 },
          { id: crypto.randomUUID(), label: "No", credit_percent: 0 },
        ]
      : [],
    rubric: writtenTypes.has(type) ? { ...defaultRubric } : null,
  };
}

export function cloneDraftQuestions(questions: DraftQuestion[]) {
  return questions.map((question) => ({
    ...question,
    id: crypto.randomUUID(),
    choices: question.choices.map((choice) => ({
      ...choice,
      id: crypto.randomUUID(),
    })),
  }));
}

export default function ScreeningQuestionBuilder({
  questions,
  status,
  version,
  onQuestionsChange,
}: Props) {
  const readOnly = status === "locked";

  const updateQuestion = (questionId: string, patch: Partial<DraftQuestion>) => {
    onQuestionsChange(
      questions.map((question) => (question.id === questionId ? { ...question, ...patch } : question)),
    );
  };

  const removeQuestion = (questionId: string) => {
    onQuestionsChange(questions.filter((question) => question.id !== questionId));
  };

  const changeType = (question: DraftQuestion, type: ScreeningQuestionType) => {
    const replacement = createDraftQuestion(type);
    updateQuestion(question.id, {
      type,
      choices: replacement.choices,
      rubric: replacement.rubric,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
        <div>
          <p className="font-medium">Scored screening questions</p>
          <p className="text-xs text-muted-foreground">
            Equal-weight questions produce a client-only score out of 100.
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          Version {version} · {status}
        </Badge>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed px-5 py-8 text-center">
          <p className="text-sm font-medium">No screening questions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add scored questions here to rank applicants before they enter the pipeline.
          </p>
        </div>
      ) : null}

      {questions.map((question, index) => (
        <div key={question.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2 text-xs font-semibold text-muted-foreground">{index + 1}</span>
            <Input
              disabled={readOnly}
              value={question.prompt}
              onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
              placeholder="Ask a screening question"
            />
            <Button
              disabled={readOnly}
              variant="ghost"
              size="icon"
              onClick={() => removeQuestion(question.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <Select
            disabled={readOnly}
            value={question.type}
            onValueChange={(value) => changeType(question, value as ScreeningQuestionType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {choiceTypes.has(question.type) ? (
            <div className="flex flex-col gap-2">
              <Label>Answer choices and credit</Label>
              {question.choices.map((choice) => (
                <div key={choice.id} className="grid grid-cols-[1fr_90px_auto] gap-2">
                  <Input
                    disabled={readOnly}
                    value={choice.label}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        choices: question.choices.map((item) =>
                          item.id === choice.id ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <Input
                    disabled={readOnly}
                    type="number"
                    min={0}
                    max={100}
                    value={choice.credit_percent}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        choices: question.choices.map((item) =>
                          item.id === choice.id
                            ? { ...item, credit_percent: Number(event.target.value) }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    disabled={readOnly || question.choices.length <= 2}
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      updateQuestion(question.id, {
                        choices: question.choices.filter((item) => item.id !== choice.id),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              {question.type !== "yes_no" ? (
                <Button
                  disabled={readOnly}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateQuestion(question.id, {
                      choices: [
                        ...question.choices,
                        { id: crypto.randomUUID(), label: "", credit_percent: 0 },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Choice
                </Button>
              ) : null}
            </div>
          ) : null}

          {writtenTypes.has(question.type) ? (
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Written responses use the fixed 1-5 rubric: 0%, 25%, 50%, 75%, and 100% credit.
            </div>
          ) : null}
        </div>
      ))}

      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onQuestionsChange([...questions, createDraftQuestion()])}
        >
          <Plus className="mr-2 size-4" />
          Add question
        </Button>
      ) : null}
    </div>
  );
}
