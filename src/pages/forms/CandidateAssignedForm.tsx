import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileText, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LeadFormRenderer from "@/components/forms/LeadFormRenderer";
import { normalizeSchema, type LeadFormSchema, type LeadFormValue } from "@/lib/leadForms";
import { toast } from "sonner";

export default function CandidateAssignedForm() {
  const { token = "" } = useParams();
  const [step, setStep] = useState<"start" | "code" | "form" | "done">("start");
  const [code, setCode] = useState(""); const [accessToken, setAccessToken] = useState("");
  const [title, setTitle] = useState("Candidate form"); const [schema, setSchema] = useState<LeadFormSchema>({ fields: [] });
  const [values, setValues] = useState<Record<string, LeadFormValue>>({}); const [busy, setBusy] = useState(false);
  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("candidate-form-verification", { body: { action, token, ...extra } });
    if (error) throw error; if (data?.error) throw new Error(data.error); return data;
  };
  const requestCode = async () => { setBusy(true); try { await invoke("request_code"); setStep("code"); toast.success("Verification code sent"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send code"); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); try { const data = await invoke("verify", { code }); setAccessToken(data.access_token); setTitle(data.title); setSchema(normalizeSchema(data.schema)); setStep("form"); } catch (error) { toast.error(error instanceof Error ? error.message : "Invalid code"); } finally { setBusy(false); } };
  const submit = async () => { if (Object.values(values).some((value) => value instanceof File)) { toast.error("File fields require a new assignment without uploads in this release"); return; } setBusy(true); try { await invoke("submit", { access_token: accessToken, answers: values }); setStep("done"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to submit form"); } finally { setBusy(false); } };
  return <div className="min-h-screen bg-background p-6 flex items-center justify-center"><main className="w-full max-w-2xl rounded-xl border bg-card p-6 space-y-6">
    {step === "done" ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto size-12 text-primary" /><h1 className="mt-4 text-xl font-semibold">Form submitted</h1><p className="mt-2 text-sm text-muted-foreground">Your response has been securely connected to your candidate profile.</p></div> : <><div><div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" />Verified candidate form</div><h1 className="mt-2 text-2xl font-bold">{title}</h1></div>
    {step === "start" && <div className="space-y-4"><p className="text-sm text-muted-foreground">We’ll send a one-time code to the email address on your candidate profile before showing this form.</p><Button onClick={requestCode} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Send verification code</Button></div>}
    {step === "code" && <div className="max-w-sm space-y-3"><Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" /><Button onClick={verify} disabled={busy || code.length !== 6}>Verify and open form</Button></div>}
    {step === "form" && <div className="space-y-5"><LeadFormRenderer schema={schema} values={values} disabled={busy} onChange={(field, value) => setValues((current) => ({ ...current, [field.id]: value }))} /><Button className="w-full" onClick={submit} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}Submit form</Button></div>}</>}
  </main></div>;
}
