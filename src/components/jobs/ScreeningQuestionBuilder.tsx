import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Copy, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ScreeningQuestionType } from "@/lib/jobScreening";

interface DraftChoice { id: string; label: string; credit_percent: number }
interface DraftQuestion { id: string; prompt: string; type: ScreeningQuestionType; choices: DraftChoice[]; rubric: Record<string, string> | null }
interface Props { jobId: string; companyId: string; userId: string }

const typeLabels: Record<ScreeningQuestionType, string> = {
  yes_no: "Yes / No", single_choice: "Single choice", multi_select: "Multiple select", number: "Number",
  short_text: "Short written answer", long_text: "Long written answer",
};
const choiceTypes = new Set<ScreeningQuestionType>(["yes_no", "single_choice", "multi_select"]);
const writtenTypes = new Set<ScreeningQuestionType>(["short_text", "long_text"]);
const defaultRubric = { "1": "Does not meet expectations", "2": "Below expectations", "3": "Meets expectations", "4": "Above expectations", "5": "Exceptional" };

function newQuestion(type: ScreeningQuestionType = "yes_no"): DraftQuestion {
  const yesNo = type === "yes_no";
  return {
    id: crypto.randomUUID(), prompt: "", type,
    choices: yesNo ? [
      { id: crypto.randomUUID(), label: "Yes", credit_percent: 100 },
      { id: crypto.randomUUID(), label: "No", credit_percent: 0 },
    ] : [],
    rubric: writtenTypes.has(type) ? { ...defaultRubric } : null,
  };
}

export default function ScreeningQuestionBuilder({ jobId, companyId, userId }: Props) {
  const [versionId, setVersionId] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: versionRow } = await supabase.from("job_screening_versions").select("*").eq("job_id", jobId).in("status", ["draft", "published", "locked"]).order("version", { ascending: false }).limit(1).maybeSingle();
    if (!versionRow) { setVersionId(null); setVersion(1); setStatus("draft"); setQuestions([]); return; }
    const { data: questionRows } = await supabase.from("job_screening_questions").select("*").eq("version_id", versionRow.id).order("position");
    const ids = (questionRows ?? []).map((q) => q.id);
    const { data: choices } = ids.length ? await supabase.from("job_screening_choices").select("*").in("question_id", ids).order("position") : { data: [] };
    setVersionId(versionRow.id); setVersion(versionRow.version); setStatus(versionRow.status);
    setQuestions((questionRows ?? []).map((q) => ({
      id: q.id, prompt: q.prompt, type: q.type,
      rubric: (q.rubric as Record<string, string> | null) ?? null,
      choices: (choices ?? []).filter((c) => c.question_id === q.id).map((c) => ({ id: c.id, label: c.label, credit_percent: c.credit_percent })),
    })));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) => setQuestions((current) => current.map((q) => q.id === id ? { ...q, ...patch } : q));

  const changeType = (question: DraftQuestion, type: ScreeningQuestionType) => {
    const replacement = newQuestion(type);
    updateQuestion(question.id, { type, choices: replacement.choices, rubric: replacement.rubric });
  };

  const save = async (publish = false) => {
    if (questions.length === 0 || questions.some((q) => !q.prompt.trim())) { toast.error("Add at least one complete screening question"); return; }
    if (questions.some((q) => choiceTypes.has(q.type) && (q.choices.length < 2 || q.choices.some((c) => !c.label.trim())))) { toast.error("Choice questions need at least two labeled answers"); return; }
    setSaving(true);
    let targetId = versionId;
    if (!targetId) {
      const { data, error } = await supabase.from("job_screening_versions").insert({ company_id: companyId, job_id: jobId, version, created_by: userId }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      targetId = data.id;
    }
    await supabase.from("job_screening_questions").delete().eq("version_id", targetId);
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const { data: saved, error } = await supabase.from("job_screening_questions").insert({
        id: question.id, version_id: targetId, position: index, type: question.type, prompt: question.prompt.trim(),
        rubric: question.rubric, settings: {},
      }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      if (choiceTypes.has(question.type)) {
        const { error: choiceError } = await supabase.from("job_screening_choices").insert(question.choices.map((choice, choiceIndex) => ({
          id: choice.id, question_id: saved.id, position: choiceIndex, label: choice.label.trim(), credit_percent: choice.credit_percent,
        })));
        if (choiceError) { toast.error(choiceError.message); setSaving(false); return; }
      }
    }
    if (publish) await supabase.from("job_screening_versions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", targetId);
    toast.success(publish ? "Screening published" : "Screening draft saved");
    setSaving(false); await load();
  };

  const cloneLocked = async () => {
    const previousQuestions = questions.map((question) => ({ ...question, id: crypto.randomUUID(), choices: question.choices.map((choice) => ({ ...choice, id: crypto.randomUUID() })) }));
    const { data, error } = await supabase.from("job_screening_versions").insert({ company_id: companyId, job_id: jobId, version: version + 1, created_by: userId }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setVersionId(data.id); setVersion((current) => current + 1); setStatus("draft"); setQuestions(previousQuestions);
    toast.success("Editable screening version created");
  };

  const readOnly = status === "locked";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-medium">Job screening questions</p><p className="text-xs text-muted-foreground">Equal-weight questions produce a client-only score out of 100.</p></div>
        <Badge variant="secondary" className="capitalize">Version {version} · {status}</Badge>
      </div>
      {questions.map((question, index) => (
        <div key={question.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start gap-2"><span className="mt-2 text-xs font-semibold text-muted-foreground">{index + 1}</span><Input disabled={readOnly} value={question.prompt} onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })} placeholder="Ask a screening question" /><Button disabled={readOnly} variant="ghost" size="icon" onClick={() => setQuestions((current) => current.filter((q) => q.id !== question.id))}><Trash2 className="size-4" /></Button></div>
          <Select disabled={readOnly} value={question.type} onValueChange={(value) => changeType(question, value as ScreeningQuestionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          {choiceTypes.has(question.type) && <div className="space-y-2">
            <Label>Answer choices and credit</Label>
            {question.choices.map((choice) => <div key={choice.id} className="grid grid-cols-[1fr_90px_auto] gap-2"><Input disabled={readOnly} value={choice.label} onChange={(e) => updateQuestion(question.id, { choices: question.choices.map((item) => item.id === choice.id ? { ...item, label: e.target.value } : item) })} /><Input disabled={readOnly} type="number" min={0} max={100} value={choice.credit_percent} onChange={(e) => updateQuestion(question.id, { choices: question.choices.map((item) => item.id === choice.id ? { ...item, credit_percent: Number(e.target.value) } : item) })} /><Button disabled={readOnly || question.choices.length <= 2} variant="ghost" size="icon" onClick={() => updateQuestion(question.id, { choices: question.choices.filter((item) => item.id !== choice.id) })}><Trash2 className="size-4" /></Button></div>)}
            {question.type !== "yes_no" && <Button disabled={readOnly} type="button" variant="outline" size="sm" onClick={() => updateQuestion(question.id, { choices: [...question.choices, { id: crypto.randomUUID(), label: "", credit_percent: 0 }] })}><Plus className="mr-1 size-3" />Choice</Button>}
          </div>}
          {writtenTypes.has(question.type) && <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Written responses use the fixed 1–5 rubric: 0%, 25%, 50%, 75%, and 100% credit.</div>}
        </div>
      ))}
      {!readOnly && <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, newQuestion()])}><Plus className="mr-2 size-4" />Add question</Button>}
      <div className="flex justify-end gap-2 border-t pt-4">
        {status === "locked" && <Button onClick={cloneLocked}><Copy className="mr-2 size-4" />Clone corrected version</Button>}
        {status === "published" && <span className="flex items-center text-sm text-muted-foreground"><LockKeyhole className="mr-2 size-4" />Live for applicants; locks on first response</span>}
        {!readOnly && <><Button variant="outline" disabled={saving} onClick={() => save(false)}>Save draft</Button><Button disabled={saving} onClick={() => save(true)}>Publish</Button></>}
      </div>
    </div>
  );
}
