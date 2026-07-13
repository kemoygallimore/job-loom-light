import { supabase } from "@/integrations/supabase/client";
import { deleteObjects, uploadToStorage } from "@/lib/storage";
import type { Json, Database } from "@/integrations/supabase/types";
import type { ScreeningQuestion } from "@/lib/jobScreening";
import type {
  ApplicationIdRow,
  CandidateIdRow,
  CandidateProfileInput,
  PublicApplicationContext,
  ResumeMetadata,
} from "./types";

type CandidateInsert = Database["public"]["Tables"]["candidates"]["Insert"] & { linkedin_url?: string | null };
type CandidateUpdate = Database["public"]["Tables"]["candidates"]["Update"] & { linkedin_url?: string | null };
type CandidateFileInsert = Database["public"]["Tables"]["candidate_files"]["Insert"];

type SupabaseMutationResult = { error: { message: string } | null };
type CandidateLinkedInMutation = {
  update: (values: CandidateUpdate) => {
    eq: (column: "id", value: string) => PromiseLike<SupabaseMutationResult>;
  };
  insert: (values: CandidateInsert) => PromiseLike<SupabaseMutationResult>;
};

function candidatesWithLinkedIn() {
  // TODO: Regenerate Supabase types so candidates.linkedin_url is available without this cast.
  return supabase.from("candidates") as unknown as CandidateLinkedInMutation;
}

function toCandidateBase(input: CandidateProfileInput) {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    linkedin_url: input.linkedinUrl.trim() || null,
    country: input.country,
    street_address: input.streetAddress.trim(),
    parish_state: input.parishState,
    education_level: input.educationLevel,
  };
}

export async function loadPublicApplicationContext(jobId: string): Promise<PublicApplicationContext | null> {
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select("id, title, description, company_id")
    .eq("id", jobId)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (jobError) throw jobError;
  if (!jobData) return null;

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", jobData.company_id)
    .maybeSingle();

  if (companyError) throw companyError;

  const { data: screeningVersion, error: screeningVersionError } = await supabase
    .from("job_screening_versions")
    .select("id")
    .eq("job_id", jobData.id)
    .in("status", ["published", "locked"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (screeningVersionError) throw screeningVersionError;

  if (!screeningVersion) {
    return {
      job: jobData,
      company: companyData ?? null,
      screeningVersionId: null,
      screeningQuestions: [],
    };
  }

  const { data: questionRows, error: questionsError } = await supabase
    .from("job_screening_questions")
    .select("*")
    .eq("version_id", screeningVersion.id)
    .order("position");

  if (questionsError) throw questionsError;

  const questionIds = (questionRows ?? []).map((question) => question.id);
  const { data: choiceRows, error: choicesError } = questionIds.length
    ? await supabase.from("job_screening_choices").select("*").in("question_id", questionIds).order("position")
    : { data: [], error: null };

  if (choicesError) throw choicesError;

  return {
    job: jobData,
    company: companyData ?? null,
    screeningVersionId: screeningVersion.id,
    screeningQuestions: (questionRows ?? []).map((question) => ({
      ...question,
      rubric: question.rubric,
      settings: question.settings,
      choices: (choiceRows ?? []).filter((choice) => choice.question_id === question.id),
    })) as ScreeningQuestion[],
  };
}

export async function submitPublicJobApplication(params: {
  jobId: string;
  candidateId: string;
  candidate: CandidateProfileInput;
  resume: ResumeMetadata;
  additionalDocuments: ResumeMetadata[];
  screeningVersionId: string | null;
  screeningAnswers: Record<string, Json>;
}) {
  const { data, error } = await supabase
    .rpc("submit_public_job_application", {
      _job_id: params.jobId,
      _candidate_id: params.candidateId,
      _candidate: {
        name: params.candidate.name,
        email: params.candidate.email,
        phone: params.candidate.phone,
        linkedinUrl: params.candidate.linkedinUrl,
        country: params.candidate.country,
        streetAddress: params.candidate.streetAddress,
        parishState: params.candidate.parishState,
        educationLevel: params.candidate.educationLevel,
      },
      _resume: params.resume,
      _additional_documents: params.additionalDocuments,
      _screening_version_id: params.screeningVersionId,
      _screening_answers: params.screeningAnswers,
    })
    .single();

  if (error) throw error;
  return data;
}

export async function cleanupUploadedApplicationFiles(files: ResumeMetadata[]) {
  const byBucket = new Map<string, string[]>();

  for (const file of files) {
    if (!file.bucket || !file.key) continue;
    const bucketKeys = byBucket.get(file.bucket) ?? [];
    bucketKeys.push(file.key);
    byBucket.set(file.bucket, bucketKeys);
  }

  for (const [bucket, keys] of byBucket) {
    try {
      await deleteObjects(bucket, keys);
    } catch (error) {
      console.error("Application upload cleanup failed:", error);
    }
  }
}

export async function findCandidateByEmail(companyId: string, normalizedEmail: string): Promise<CandidateIdRow | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("company_id", companyId)
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findExistingApplication(jobId: string, candidateId: string): Promise<ApplicationIdRow | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function uploadResumeFile(file: File, companyId: string, candidateId: string, jobId: string) {
  return uploadToStorage({
    file,
    category: "resume",
    companyId,
    candidateId,
    jobId,
  });
}

export async function updateExistingCandidate(
  candidateId: string,
  input: CandidateProfileInput,
  resume: ResumeMetadata,
) {
  const { error } = await candidatesWithLinkedIn()
    .update({
      ...toCandidateBase(input),
      resume_url: resume.key,
      resume_bucket: resume.bucket,
      resume_object_key: resume.key,
      resume_filename: resume.filename,
      resume_content_type: resume.contentType,
      resume_size_bytes: resume.size,
    })
    .eq("id", candidateId);

  if (error) throw error;
}

export async function insertCandidate(candidateId: string, companyId: string, input: CandidateProfileInput) {
  const { error } = await candidatesWithLinkedIn().insert({
    id: candidateId,
    company_id: companyId,
    email: input.email,
    ...toCandidateBase(input),
  });

  if (error) throw error;
}

export async function updateCandidateResume(candidateId: string, resume: ResumeMetadata) {
  const { error } = await supabase
    .from("candidates")
    .update({
      resume_url: resume.key,
      resume_bucket: resume.bucket,
      resume_object_key: resume.key,
      resume_filename: resume.filename,
      resume_content_type: resume.contentType,
      resume_size_bytes: resume.size,
    })
    .eq("id", candidateId);

  if (error) throw error;
}

export async function archiveResumeVersion(
  candidateId: string,
  companyId: string,
  jobId: string,
  resume: ResumeMetadata,
) {
  const { error } = await supabase.rpc("archive_resume_version", {
    _candidate_id: candidateId,
    _company_id: companyId,
    _job_id: jobId,
    _bucket: resume.bucket,
    _file_key: resume.key,
    _file_name: resume.filename,
    _file_type: resume.contentType,
    _file_size: resume.size,
  });
  return error;
}

export async function createApplication(companyId: string, jobId: string, candidateId: string) {
  const { data, error } = await supabase
    .from("applications")
    .insert({
      company_id: companyId,
      job_id: jobId,
      candidate_id: candidateId,
      stage: "applied",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function createScreeningResponse(params: {
  companyId: string;
  applicationId: string;
  screeningVersionId: string;
  status: Database["public"]["Enums"]["screening_response_status"];
  score: number;
  reviewNeededCount: number;
}) {
  const { data, error } = await supabase
    .from("job_screening_responses")
    .insert({
      company_id: params.companyId,
      application_id: params.applicationId,
      version_id: params.screeningVersionId,
      status: params.status,
      score: params.score,
      review_needed_count: params.reviewNeededCount,
      finalized_at: params.status === "final" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function insertScreeningAnswers(
  responseId: string,
  answers: Array<{ question_id: string; answer: Json; earned_percent: number | null }>,
) {
  const { error } = await supabase.from("job_screening_answers").insert(
    answers.map((answer) => ({
      response_id: responseId,
      ...answer,
    })),
  );

  if (error) throw error;
}

export async function uploadAdditionalDocument(file: File, companyId: string, jobId: string, candidateId: string) {
  return uploadToStorage({
    file,
    companyId,
    jobId,
    candidateId,
    category: "document",
  });
}

export async function insertCandidateFile(row: CandidateFileInsert) {
  const { error } = await supabase.from("candidate_files").insert(row);
  return error;
}
