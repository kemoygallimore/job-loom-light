import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { FileText, Plus, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  inviteResultDescription,
  reissueCandidateFormInvitation,
  resendCandidateFormInvitation,
  revokeCandidateFormInvitation,
  sendCandidateFormInvites,
} from "@/lib/candidateFormInvitations";

interface Props {
  candidateId: string;
  companyId: string;
  userId: string;
  candidateEmail: string | null;
}
interface FormOption {
  id: string;
  title: string;
}
interface AssignmentRow {
  id: string;
  form_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  lead_forms?: { title: string | null } | { title: string | null }[] | null;
}

function relatedTitle(value: AssignmentRow["lead_forms"]) {
  if (Array.isArray(value)) return value[0]?.title;
  return value?.title;
}

function displayStatus(assignment: AssignmentRow) {
  if (assignment.status === "pending" && new Date(assignment.expires_at).getTime() <= Date.now()) return "expired";
  return assignment.status;
}

export default function CandidateForms({ candidateId, companyId, candidateEmail }: Props) {
  const [forms, setForms] = useState<FormOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [formId, setFormId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [{ data: formRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("lead_forms").select("id, title").eq("company_id", companyId).eq("status", "active").is("deleted_at", null).order("title", { ascending: true }),
      supabase
        .from("candidate_form_assignments")
        .select("id, form_id, status, expires_at, created_at, lead_forms(title)")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
    ]);
    const nextForms = (formRows ?? []) as FormOption[];
    setForms(nextForms);
    setAssignments((assignmentRows ?? []) as unknown as AssignmentRow[]);
    setFormId((current) => (current && nextForms.some((form) => form.id === current) ? current : nextForms[0]?.id ?? ""));
  }, [candidateId, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!candidateEmail) {
      toast.error("Add a valid candidate email before sending a form");
      return;
    }
    if (!formId || sending) return;
    setSending(true);
    try {
      const result = await sendCandidateFormInvites(formId, [candidateId]);
      toast.success("Form invitation processed", {
        description: inviteResultDescription(result) || undefined,
      });
      setFormId("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send form invitation");
    } finally {
      setSending(false);
    }
  };

  const runAssignmentAction = async (assignmentId: string, action: "resend" | "reissue" | "revoke") => {
    setBusyId(assignmentId);
    try {
      if (action === "resend") await resendCandidateFormInvitation(assignmentId);
      if (action === "reissue") await reissueCandidateFormInvitation(assignmentId);
      if (action === "revoke") await revokeCandidateFormInvitation(assignmentId);
      toast.success(action === "revoke" ? "Invitation revoked" : "Invitation sent");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update invitation");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Candidate forms</h2>
        <p className="text-sm text-muted-foreground">Send reusable company forms with candidate-specific single-use links.</p>
      </div>
      <div className="flex gap-2">
        <Select value={formId} onValueChange={setFormId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an active form" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((form) => (
              <SelectItem key={form.id} value={form.id}>
                {form.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={!formId || !candidateEmail || sending} onClick={send}>
          <Plus className="mr-2 size-4" />
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>
      {!candidateEmail && <p className="text-sm text-destructive">A candidate email is required before a form can be sent.</p>}
      <div className="divide-y rounded-lg border">
        {assignments.map((assignment) => {
          const status = displayStatus(assignment);
          const isBusy = busyId === assignment.id;
          return (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{relatedTitle(assignment.lead_forms) ?? "Candidate form"}</p>
                  <p className="text-xs text-muted-foreground">
                    Sent {format(new Date(assignment.created_at), "MMM d, yyyy")} · expires {format(new Date(assignment.expires_at), "MMM d")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status === "completed" ? "default" : "secondary"} className="capitalize">{status}</Badge>
                {status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => runAssignmentAction(assignment.id, "resend")} disabled={isBusy}>
                      <RefreshCw className="mr-2 size-3.5" />
                      Resend
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runAssignmentAction(assignment.id, "revoke")} disabled={isBusy}>
                      <XCircle className="mr-2 size-3.5" />
                      Revoke
                    </Button>
                  </>
                )}
                {(status === "completed" || status === "expired" || status === "verified") && (
                  <Button size="sm" variant="outline" onClick={() => runAssignmentAction(assignment.id, "reissue")} disabled={isBusy}>
                    <RotateCcw className="mr-2 size-3.5" />
                    Reissue
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {assignments.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No forms sent yet.</p>}
      </div>
    </div>
  );
}
