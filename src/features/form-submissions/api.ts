import { supabase } from "@/integrations/supabase/client";
import { LeadForm, LeadFormSubmission, LeadFormUpload, normalizeSchema } from "@/lib/leadForms";
import { resolveFileUrl } from "@/lib/storage";
import type {
  FormSubmissionsResult,
  LeadFormRow,
  LeadFormSubmissionRow,
  LeadFormUploadRow,
} from "./types";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toLeadForm(row: LeadFormRow): LeadForm {
  return {
    ...row,
    status: row.status === "disabled" ? "disabled" : "active",
    schema: normalizeSchema(row.schema),
  };
}

function toLeadFormSubmission(row: LeadFormSubmissionRow): LeadFormSubmission {
  return {
    ...row,
    answers: toRecord(row.answers),
    schema_snapshot: normalizeSchema(row.schema_snapshot),
    status: row.status === "reviewed" ? "reviewed" : "new",
  };
}

function toLeadFormUpload(row: LeadFormUploadRow): LeadFormUpload {
  return row;
}

export async function getFormWithSubmissions(
  formId: string,
  companyId: string,
): Promise<FormSubmissionsResult> {
  const [formResult, submissionsResult] = await Promise.all([
    supabase
      .from("lead_forms")
      .select("*")
      .eq("id", formId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("lead_form_submissions")
      .select("*")
      .eq("form_id", formId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (formResult.error || !formResult.data) {
    throw new Error(formResult.error?.message ?? "Form not found");
  }

  return {
    form: toLeadForm(formResult.data),
    submissions: (submissionsResult.data ?? []).map(toLeadFormSubmission),
    submissionErrorMessage: submissionsResult.error?.message ?? null,
  };
}

export async function getSubmissionUploads(submissionId: string) {
  const { data } = await supabase
    .from("lead_form_uploads")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  return (data ?? []).map(toLeadFormUpload);
}

export async function markSubmissionReviewed(submissionId: string) {
  await supabase.from("lead_form_submissions").update({ status: "reviewed" }).eq("id", submissionId);
}

export async function getCurrentAccessToken() {
  return (await supabase.auth.getSession()).data.session?.access_token;
}

export async function getSignedUploadUrl(upload: LeadFormUpload, accessToken?: string) {
  return resolveFileUrl(upload.object_key, upload.bucket, accessToken);
}
