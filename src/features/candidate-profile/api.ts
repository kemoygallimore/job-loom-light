import { supabase } from "@/integrations/supabase/client";
import { R2_BUCKET_RESUMES, getSignedViewUrl } from "@/lib/storage";
import type { PipelineStage } from "@/lib/pipeline";
import type {
  ApplicationQueryRow,
  Candidate,
  CandidateProfileData,
  EmailLog,
  EmailLogRow,
  NoteRow,
  ProfileRow,
} from "./types";
import { jsonRecord } from "./types";

function toEmailLog(row: EmailLogRow): EmailLog {
  return {
    id: row.id,
    template_key: row.template_key,
    recipient_email: row.recipient_email,
    status: row.status,
    context: jsonRecord(row.context),
    created_at: row.created_at,
  };
}

export function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export async function fetchCandidateProfile(candidateId: string): Promise<CandidateProfileData> {
  const [cRes, aRes, nRes, eRes] = await Promise.all([
    supabase.from("candidates").select("*").eq("id", candidateId).single(),
    supabase
      .from("applications")
      .select("id, stage, updated_at, created_at, job_id, jobs(title, hiring_manager)")
      .eq("candidate_id", candidateId)
      .order("updated_at", { ascending: false }),
    supabase.from("notes").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    supabase
      .from("email_send_log")
      .select("id, template_key, recipient_email, status, context, created_at")
      .eq("candidate_id", candidateId)
      .eq("status", "sent")
      .order("created_at", { ascending: false }),
  ]);

  if (cRes.error || !cRes.data) {
    throw new Error("Candidate not found");
  }

  const rawNotes = (nRes.data ?? []) as NoteRow[];
  const authorIds = [...new Set(rawNotes.map((note) => note.user_id))];
  const authorMap: Record<string, string> = {};

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", authorIds);
    (profiles ?? []).forEach((profileRow: Pick<ProfileRow, "user_id" | "name">) => {
      authorMap[profileRow.user_id] = profileRow.name ?? "Unknown";
    });
  }

  return {
    candidate: cRes.data as unknown as Candidate,
    applications: ((aRes.data ?? []) as unknown as ApplicationQueryRow[]).map((a) => ({
      id: a.id,
      stage: a.stage,
      updated_at: a.updated_at,
      created_at: a.created_at,
      job_id: a.job_id,
      job_title: a.jobs?.title ?? "Unknown",
      hiring_manager: a.jobs?.hiring_manager ?? null,
    })),
    notes: rawNotes.map((n) => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      user_id: n.user_id,
      author_name: authorMap[n.user_id] ?? "Unknown",
    })),
    emailLogs: (eRes.data ?? []).map((row) => toEmailLog(row as EmailLogRow)),
  };
}

export async function updateApplicationStage(appId: string, newStage: PipelineStage) {
  const { error } = await supabase.from("applications").update({ stage: newStage }).eq("id", appId);
  if (error) throw error;
  return { appId, newStage };
}

export async function getResumeViewUrl(candidate: Candidate) {
  const bucket = candidate.resume_bucket ?? R2_BUCKET_RESUMES;
  const key = candidate.resume_object_key ?? candidate.resume_url;

  if (!key) {
    throw new Error("Resume not found");
  }

  const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
  return getSignedViewUrl(bucket, key, accessToken);
}
