import type { Database } from "@/integrations/supabase/types";
import type { LeadForm, LeadFormSubmission, LeadFormUpload } from "@/lib/leadForms";

export type LeadFormRow = Database["public"]["Tables"]["lead_forms"]["Row"];
export type LeadFormSubmissionRow = Database["public"]["Tables"]["lead_form_submissions"]["Row"];
export type LeadFormUploadRow = Database["public"]["Tables"]["lead_form_uploads"]["Row"];

export type FormSubmissionsResult = {
  form: LeadForm;
  submissions: LeadFormSubmission[];
  submissionErrorMessage: string | null;
};

export type { LeadForm, LeadFormSubmission, LeadFormUpload };
