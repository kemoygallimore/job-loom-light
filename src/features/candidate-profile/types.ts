import type { NoteWithAuthor } from "@/components/candidate/CandidateNotes";
import type { Database, Json } from "@/integrations/supabase/types";

export type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"];
export type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
export type EmailLogRow = Database["public"]["Tables"]["email_send_log"]["Row"];
export type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// TODO: Regenerate Supabase types after adding candidates.linkedin_url.
export type Candidate = CandidateRow & {
  linkedin_url?: string | null;
};

export interface ApplicationWithJob {
  id: string;
  stage: string;
  updated_at: string;
  created_at: string;
  job_id: string;
  job_title: string;
  hiring_manager: string | null;
}

export interface EmailLog {
  id: string;
  template_key: string;
  recipient_email: string;
  status: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

export interface ApplicationQueryRow extends Pick<ApplicationRow, "id" | "stage" | "updated_at" | "created_at" | "job_id"> {
  jobs: { title: string | null; hiring_manager: string | null } | null;
}

export interface CandidateProfileData {
  applications: ApplicationWithJob[];
  candidate: Candidate;
  emailLogs: EmailLog[];
  notes: NoteWithAuthor[];
}

export function jsonRecord(value: Json | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
