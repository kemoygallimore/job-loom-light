import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

interface Props { candidateId: string; companyId: string; userId: string; candidateEmail: string | null }
interface FormOption { id: string; title: string; schema: Json }

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function CandidateForms({ candidateId, companyId, userId, candidateEmail }: Props) {
  const { role } = useAuth();
  const [forms, setForms] = useState<FormOption[]>([]);
  const [assignments, setAssignments] = useState<Array<{ id: string; form_id: string; status: string; expires_at: string; created_at: string }>>([]);
  const [formId, setFormId] = useState("");

  const load = useCallback(async () => {
    const [{ data: formRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("lead_forms").select("id, title, schema").eq("company_id", companyId).eq("status", "active").is("deleted_at", null),
      supabase.from("candidate_form_assignments").select("id, form_id, status, expires_at, created_at").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    ]);
    setForms((formRows ?? []) as FormOption[]); setAssignments(assignmentRows ?? []);
  }, [candidateId, companyId]);
  useEffect(() => { load(); }, [load]);

  const assign = async () => {
    if (!candidateEmail) { toast.error("Add a valid candidate email before assigning a form"); return; }
    const form = forms.find((item) => item.id === formId); if (!form) return;
    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const { error } = await supabase.from("candidate_form_assignments").insert({
      company_id: companyId, form_id: form.id, candidate_id: candidateId, created_by: userId,
      token_hash: await sha256(rawToken), schema_snapshot: form.schema, expires_at: addDays(new Date(), 7).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    const link = `${window.location.origin}/candidate-form/${rawToken}`;
    await navigator.clipboard.writeText(link);
    toast.success("Candidate-only form link created and copied"); setFormId(""); await load();
  };
  const reset = async (assignmentId: string) => {
    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const { error } = await supabase.rpc("reset_candidate_form_assignment", { _assignment_id: assignmentId, _token_hash: await sha256(rawToken), _expires_at: addDays(new Date(), 7).toISOString() });
    if (error) { toast.error(error.message); return; }
    await navigator.clipboard.writeText(`${window.location.origin}/candidate-form/${rawToken}`);
    toast.success("New verified form invitation created and copied"); await load();
  };

  return <div className="rounded-xl border bg-card p-6 space-y-5">
    <div><h2 className="font-semibold">Candidate forms</h2><p className="text-sm text-muted-foreground">Assignments are candidate-level and require an email verification code.</p></div>
    <div className="flex gap-2"><Select value={formId} onValueChange={setFormId}><SelectTrigger><SelectValue placeholder="Choose an active form" /></SelectTrigger><SelectContent>{forms.map((form) => <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>)}</SelectContent></Select><Button disabled={!formId || !candidateEmail} onClick={assign}><Plus className="mr-2 size-4" />Assign</Button></div>
    {!candidateEmail && <p className="text-sm text-destructive">A candidate email is required before a form can be assigned.</p>}
    <div className="divide-y rounded-lg border">{assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-3 p-3"><div className="flex items-center gap-3"><FileText className="size-4 text-muted-foreground" /><div><p className="text-sm font-medium">{forms.find((form) => form.id === assignment.form_id)?.title ?? "Candidate form"}</p><p className="text-xs text-muted-foreground">Assigned {format(new Date(assignment.created_at), "MMM d, yyyy")} · expires {format(new Date(assignment.expires_at), "MMM d")}</p></div></div><div className="flex items-center gap-2"><Badge variant="secondary" className="capitalize">{assignment.status}</Badge>{role === "admin" && assignment.status === "completed" && <Button size="sm" variant="outline" onClick={() => reset(assignment.id)}>Reset</Button>}</div></div>)}{assignments.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No forms assigned yet.</p>}</div>
  </div>;
}
