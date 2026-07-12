import type { Json, Database } from "@/integrations/supabase/types";
import type { ScreeningQuestion } from "@/lib/jobScreening";

export type JobSummary = Pick<Database["public"]["Tables"]["jobs"]["Row"], "id" | "title" | "description" | "company_id">;
export type CompanySummary = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "name">;
export type CandidateIdRow = Pick<Database["public"]["Tables"]["candidates"]["Row"], "id">;
export type ApplicationIdRow = Pick<Database["public"]["Tables"]["applications"]["Row"], "id">;

export interface PublicApplicationContext {
  job: JobSummary;
  company: CompanySummary | null;
  screeningVersionId: string | null;
  screeningQuestions: ScreeningQuestion[];
}

export interface ApplicationFormState {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  country: string;
  streetAddress: string;
  parishState: string;
  educationLevel: string;
  resumeFile: File | null;
  additionalFiles: File[];
  agreedToTerms: boolean;
  screeningAnswers: Record<string, Json>;
}

export type FormErrors = Record<string, string>;

export interface CandidateProfileInput {
  name: string;
  email?: string;
  phone: string;
  linkedinUrl: string;
  country: string;
  streetAddress: string;
  parishState: string;
  educationLevel: string;
}

export interface ResumeMetadata {
  bucket: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}
