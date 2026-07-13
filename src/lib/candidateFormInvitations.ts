import { supabase } from "@/integrations/supabase/client";

export interface CandidateFormInviteResult {
  ok?: boolean;
  created?: number;
  resent?: number;
  skipped_existing?: number;
  skipped_invalid_email?: number;
  failed_email?: number;
  error?: string;
}

async function invokeCandidateForm(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<CandidateFormInviteResult>("candidate-form-verification", {
    body: { action, ...extra },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    const payload = response ? await response.json().catch(() => null) : null;
    const message = payload && typeof payload === "object" && "error" in payload
      ? String(payload.error)
      : error.message;
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

export async function sendCandidateFormInvites(formId: string, candidateIds: string[]) {
  return invokeCandidateForm("send_invites", {
    form_id: formId,
    candidate_ids: candidateIds,
  });
}

export async function resendCandidateFormInvitation(assignmentId: string) {
  return invokeCandidateForm("resend", { assignment_id: assignmentId });
}

export async function reissueCandidateFormInvitation(assignmentId: string) {
  return invokeCandidateForm("reissue", { assignment_id: assignmentId });
}

export async function revokeCandidateFormInvitation(assignmentId: string) {
  return invokeCandidateForm("revoke", { assignment_id: assignmentId });
}

export async function deleteCandidateForm(formId: string) {
  return invokeCandidateForm("delete_form", { form_id: formId });
}

export function inviteResultDescription(result: CandidateFormInviteResult) {
  return [
    result.created ? `${result.created} new` : null,
    result.resent ? `${result.resent} resent` : null,
    result.skipped_existing ? `${result.skipped_existing} already completed` : null,
    result.skipped_invalid_email ? `${result.skipped_invalid_email} skipped` : null,
    result.failed_email ? `${result.failed_email} email failed` : null,
  ].filter(Boolean).join(", ");
}
