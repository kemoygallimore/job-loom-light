import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const R2_WORKER_BASE_URL = (Deno.env.get("R2_WORKER_BASE_URL") || "https://api.rizonhire.com").replace(/\/+$/, "");
const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");

const R2_BUCKET_RESUMES = "silverweb-ats-resumes";
const R2_BUCKET_VIDEOS = "silverweb-ats-videos";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type StoredObjectTarget = { bucket: string; key: string };
type AuthResult =
  | { ok: true; userId: string; companyId: string | null; isAdmin: boolean; isSuperAdmin: boolean }
  | { ok: false; response: Response };

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

function addStoredObject(
  targets: Map<string, StoredObjectTarget>,
  bucket: string | null | undefined,
  key: string | null | undefined,
  fallbackBucket: string,
) {
  const cleanKey = key?.trim();
  if (!cleanKey || /^https?:\/\//i.test(cleanKey)) return;

  const cleanBucket = bucket?.trim() || fallbackBucket;
  targets.set(`${cleanBucket}:${cleanKey}`, { bucket: cleanBucket, key: cleanKey });
}

async function requireAdmin(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, response: json(401, { error: "Unauthorized" }) };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return { ok: false, response: json(401, { error: "Unauthorized" }) };

  const [profileRes, rolesRes] = await Promise.all([
    admin.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (profileRes.error) return { ok: false, response: json(403, { error: "Company profile not found" }) };
  if (rolesRes.error) return { ok: false, response: json(403, { error: "Could not verify user role" }) };

  const roles = new Set((rolesRes.data ?? []).map((row) => row.role));
  const isAdmin = roles.has("admin");
  const isSuperAdmin = roles.has("super_admin");

  if (!isAdmin && !isSuperAdmin) {
    return { ok: false, response: json(403, { error: "Only company admins can permanently delete candidates." }) };
  }

  return { ok: true, userId: user.id, companyId: profileRes.data?.company_id ?? null, isAdmin, isSuperAdmin };
}

async function collectCandidateStorageObjects(candidateId: string, actor: Extract<AuthResult, { ok: true }>) {
  const targets = new Map<string, StoredObjectTarget>();

  const { data: candidate, error: candidateError } = await admin
    .from("candidates")
    .select("id, company_id, email, resume_bucket, resume_object_key, resume_url")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) throw candidateError;
  if (!candidate) throw new Error("Candidate not found.");
  if (!actor.isSuperAdmin && candidate.company_id !== actor.companyId) {
    throw new Error("You cannot delete candidates outside your company.");
  }

  addStoredObject(targets, candidate.resume_bucket, candidate.resume_object_key ?? candidate.resume_url, R2_BUCKET_RESUMES);

  const [{ data: candidateFiles, error: candidateFilesError }, { data: assignments, error: assignmentsError }, { data: directSubmissions, error: directSubmissionsError }, { data: screeningSubmissions, error: screeningSubmissionsError }] =
    await Promise.all([
      admin.from("candidate_files").select("bucket, file_key").eq("candidate_id", candidateId),
      admin.from("candidate_form_assignments").select("id").eq("candidate_id", candidateId),
      admin.from("lead_form_submissions").select("id").eq("candidate_id", candidateId),
      candidate.email
        ? admin
            .from("screening_submissions")
            .select("video_bucket, video_object_key, video_url")
            .eq("company_id", candidate.company_id)
            .ilike("candidate_email", candidate.email.trim())
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (candidateFilesError) throw candidateFilesError;
  if (assignmentsError) throw assignmentsError;
  if (directSubmissionsError) throw directSubmissionsError;
  if (screeningSubmissionsError) throw screeningSubmissionsError;

  for (const file of candidateFiles ?? []) {
    addStoredObject(targets, file.bucket, file.file_key, R2_BUCKET_RESUMES);
  }

  for (const submission of screeningSubmissions ?? []) {
    addStoredObject(targets, submission.video_bucket, submission.video_object_key ?? submission.video_url, R2_BUCKET_VIDEOS);
  }

  const submissionIds = new Set((directSubmissions ?? []).map((submission) => submission.id));
  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);

  if (assignmentIds.length > 0) {
    const { data, error } = await admin.from("lead_form_submissions").select("id").in("assignment_id", assignmentIds);
    if (error) throw error;
    for (const submission of data ?? []) {
      submissionIds.add(submission.id);
    }
  }

  if (submissionIds.size > 0) {
    const { data, error } = await admin
      .from("lead_form_uploads")
      .select("bucket, object_key")
      .in("submission_id", Array.from(submissionIds));

    if (error) throw error;

    for (const upload of data ?? []) {
      addStoredObject(targets, upload.bucket, upload.object_key, R2_BUCKET_RESUMES);
    }
  }

  return Array.from(targets.values());
}

async function deleteR2Objects(targets: StoredObjectTarget[]) {
  if (targets.length === 0) return 0;
  if (!R2_WORKER_SECRET) throw new Error("R2_WORKER_SECRET is not configured.");

  const byBucket = new Map<string, string[]>();
  for (const target of targets) {
    const keys = byBucket.get(target.bucket) ?? [];
    keys.push(target.key);
    byBucket.set(target.bucket, keys);
  }

  let deleted = 0;
  for (const [bucket, keys] of byBucket) {
    const response = await fetch(`${R2_WORKER_BASE_URL}/delete-object`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${R2_WORKER_SECRET}`,
      },
      body: JSON.stringify({ bucket, keys }),
    });

    if (!response.ok && response.status !== 404) {
      const details = await response.text().catch(() => "");
      throw new Error(`R2 delete failed (${response.status}): ${details || response.statusText}`);
    }

    deleted += keys.length;
  }

  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const actor = await requireAdmin(req);
  if (!actor.ok) return actor.response;

  try {
    const body = await req.json().catch(() => ({}));
    const candidateId = String(body?.candidate_id ?? "").trim();
    if (!candidateId) return json(400, { error: "candidate_id is required" });

    const storageTargets = await collectCandidateStorageObjects(candidateId, actor);
    const deletedObjects = await deleteR2Objects(storageTargets);

    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data, error } = await userClient.rpc("delete_candidate_for_privacy", { _candidate_id: candidateId });
    if (error) throw error;

    return json(200, {
      ok: true,
      deleted_objects: deletedObjects,
      database: data,
    });
  } catch (error: unknown) {
    return json(500, { error: error instanceof Error ? error.message : "Candidate privacy deletion failed" });
  }
});
