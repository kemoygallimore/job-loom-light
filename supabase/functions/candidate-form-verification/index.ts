import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RIZONHIRE_FROM_EMAIL") ?? "RizonHire <no-reply@rizonhire.com>";
const DEFAULT_EXPIRY_DAYS = 7;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

type AssignmentStatus = "pending" | "verified" | "completed" | "expired" | "revoked" | "superseded";
type AssignmentRow = {
  id: string;
  company_id: string;
  form_id: string;
  candidate_id: string;
  created_by: string;
  token_hash: string;
  status: AssignmentStatus;
  schema_snapshot: unknown;
  expires_at: string;
  created_at: string;
};
type LeadFormRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  deleted_at: string | null;
  schema: unknown;
};
type CandidateRow = {
  id: string;
  company_id: string;
  name: string | null;
  email: string | null;
};
type CompanyRow = {
  id: string;
  name: string | null;
  status: string | null;
  email_domain: string | null;
  email_domain_status: string | null;
  email_from_name: string | null;
  email_reply_to: string | null;
};
type AuthenticatedProfile = { userId: string; companyId: string };
type AuthResult = { ok: true; profile: AuthenticatedProfile } | { ok: false; response: Response };

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeText(value: unknown, maxLength = 2000) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

function normalizeOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return origin && /^https?:\/\//i.test(origin) ? origin.replace(/\/+$/, "") : "https://app.rizonhire.com";
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(value: string) {
  return new Date(value).getTime() <= Date.now();
}

function isValidEmail(value: string | null | undefined) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function requireAuthenticatedProfile(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, response: respond(401, { error: "Unauthorized" }) };

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error } = await userClient.auth.getUser();
  const user = userData?.user;
  if (error || !user) return { ok: false, response: respond(401, { error: "Unauthorized" }) };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("user_id, company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.company_id) return { ok: false, response: respond(403, { error: "Company profile not found" }) };
  return { ok: true, profile: { userId: user.id, companyId: profile.company_id } };
}

function resolveSender(company: CompanyRow | null) {
  if (company?.email_domain && company.email_domain_status === "verified") {
    const displayName = normalizeText(company.email_from_name || company.name || "Careers", 80).replace(/[<>"]/g, "");
    return {
      fromAddress: `${displayName} <no-reply@${company.email_domain}>`,
      replyTo: company.email_reply_to || undefined,
    };
  }

  return { fromAddress: FROM_ADDRESS, replyTo: undefined };
}

async function sendInvitationEmail(req: Request, args: {
  company: CompanyRow | null;
  candidate: CandidateRow;
  form: LeadFormRow;
  token: string;
  assignmentId: string;
}) {
  const recipient = normalizeText(args.candidate.email, 320).toLowerCase();
  if (!isValidEmail(recipient)) return { ok: false, error: "Candidate email is invalid" };
  if (!RESEND_API_KEY) return { ok: false, error: "Email delivery is not configured" };

  const { fromAddress, replyTo } = resolveSender(args.company);
  const formLink = `${normalizeOrigin(req)}/candidate-form/${args.token}`;
  const companyName = normalizeText(args.company?.name || "the hiring team", 120);
  const candidateName = normalizeText(args.candidate.name || "there", 120);
  const formTitle = normalizeText(args.form.title || "Candidate form", 160);
  const subject = `Please complete ${formTitle}`;
  const html = [
    `<p>Hi ${candidateName},</p>`,
    `<p>${companyName} has requested additional information from you.</p>`,
    `<p><a href="${formLink}">Complete ${formTitle}</a></p>`,
    `<p>This secure link is unique to your candidate profile and expires in ${DEFAULT_EXPIRY_DAYS} days.</p>`,
  ].join("");

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress, to: [recipient], subject, html, reply_to: replyTo }),
  });
  const providerData = await emailResponse.json().catch(() => ({}));
  const logRow = {
    template_key: "candidate_form_invitation",
    recipient_email: recipient,
    company_id: args.company?.id ?? args.form.company_id,
    candidate_id: args.candidate.id,
    application_id: null,
    context: {
      form_id: args.form.id,
      form_title: formTitle,
      assignment_id: args.assignmentId,
    },
    from_address: fromAddress,
    reply_to: replyTo ?? null,
  };

  if (!emailResponse.ok) {
    await admin.from("email_send_log").insert({
      ...logRow,
      status: "failed",
      error_message: JSON.stringify(providerData).slice(0, 1000),
    });
    return { ok: false, error: "Unable to send invitation email" };
  }

  await admin.from("email_send_log").insert({
    ...logRow,
    status: "sent",
    provider_message_id: providerData?.id ?? null,
  });
  return { ok: true };
}

async function loadForm(formId: string, companyId: string) {
  const { data, error } = await admin
    .from("lead_forms")
    .select("*")
    .eq("id", formId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LeadFormRow;
}

async function loadCompany(companyId: string) {
  const { data } = await admin
    .from("companies")
    .select("id, name, status, email_domain, email_domain_status, email_from_name, email_reply_to")
    .eq("id", companyId)
    .maybeSingle();
  return (data as CompanyRow | null) ?? null;
}

async function loadAssignmentByToken(token: string) {
  const tokenHash = await hash(token);
  const { data } = await admin
    .from("candidate_form_assignments")
    .select("*, lead_forms(*), candidates(id, company_id, name, email)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;

  const assignment = data as AssignmentRow & {
    lead_forms?: LeadFormRow | LeadFormRow[] | null;
    candidates?: CandidateRow | CandidateRow[] | null;
  };
  return {
    assignment,
    form: firstRelated(assignment.lead_forms),
    candidate: firstRelated(assignment.candidates),
  };
}

function unavailable() {
  return respond(404, { error: "This form invitation is unavailable" });
}

async function assertUsableInvitation(token: string) {
  const loaded = await loadAssignmentByToken(token);
  if (!loaded?.assignment || !loaded.form || !loaded.candidate) return { ok: false as const, response: unavailable() };
  const company = await loadCompany(loaded.assignment.company_id);
  if (
    loaded.assignment.status !== "pending" ||
    isExpired(loaded.assignment.expires_at) ||
    loaded.form.status !== "active" ||
    loaded.form.deleted_at ||
    company?.status !== "active"
  ) {
    return { ok: false as const, response: unavailable() };
  }
  return { ok: true as const, ...loaded, company };
}

function schemaFields(schema: unknown): Array<Record<string, unknown>> {
  if (!schema || typeof schema !== "object" || !Array.isArray((schema as { fields?: unknown }).fields)) return [];
  return (schema as { fields: unknown[] }).fields.filter((field): field is Record<string, unknown> => !!field && typeof field === "object" && !Array.isArray(field));
}

function isEmptyValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  if (value && typeof value === "object" && "fileName" in value) return false;
  return value === null || value === undefined || String(value).trim() === "";
}

function consentPayload(body: Record<string, unknown>, key: string) {
  const consents = body.consents && typeof body.consents === "object" && !Array.isArray(body.consents)
    ? body.consents as Record<string, unknown>
    : {};
  const item = consents[key] && typeof consents[key] === "object" && !Array.isArray(consents[key])
    ? consents[key] as Record<string, unknown>
    : {};
  return {
    accepted: item.accepted === true,
    consentText: normalizeText(item.consent_text, 2000),
    pagePath: normalizeText(item.page_path, 500),
  };
}

function validateAnswers(schema: unknown, answers: Record<string, unknown>) {
  for (const field of schemaFields(schema)) {
    const id = typeof field.id === "string" ? field.id : "";
    const type = typeof field.type === "string" ? field.type : "";
    if (!id || type === "section") continue;

    const value = answers[id];
    if (field.required === true && isEmptyValue(value)) throw new Error(`Required field missing: ${id}`);
    if (isEmptyValue(value)) continue;

    const text = typeof value === "string" ? value : null;
    if (type === "email" && text && !/^\S+@\S+\.\S+$/.test(text.trim())) throw new Error(`Invalid email field: ${id}`);
    if (type === "url" && text) {
      try {
        new URL(text);
      } catch {
        throw new Error(`Invalid URL field: ${id}`);
      }
    }

    const validation = field.validation && typeof field.validation === "object" ? field.validation as Record<string, unknown> : {};
    const minLength = Number(validation.minLength);
    const maxLength = Number(validation.maxLength);
    if (text && Number.isFinite(minLength) && minLength > 0 && text.trim().length < minLength) {
      throw new Error(`Field is shorter than allowed: ${id}`);
    }
    if (text && Number.isFinite(maxLength) && maxLength > 0 && text.trim().length > maxLength) {
      throw new Error(`Field is longer than allowed: ${id}`);
    }
  }
}

function validateUploads(schema: unknown, uploadRows: Record<string, unknown>[]) {
  const fields = schemaFields(schema);
  const fileFields = new Map(fields.filter((field) => field.type === "file").map((field) => [String(field.id), field]));

  for (const upload of uploadRows) {
    const fieldId = normalizeText(upload.field_id, 200);
    const field = fileFields.get(fieldId);
    if (!field) throw new Error(`Invalid upload field: ${fieldId}`);

    const uploadSettings = field.upload && typeof field.upload === "object" ? field.upload as Record<string, unknown> : {};
    const maxSizeMb = Number(uploadSettings.maxSizeMb) || 10;
    const fileSize = Number(upload.file_size) || 0;
    if (fileSize <= 0 || fileSize > maxSizeMb * 1024 * 1024) throw new Error(`Upload size is not allowed: ${fieldId}`);

    const categories = Array.isArray(uploadSettings.allowedCategories) ? uploadSettings.allowedCategories.map(String) : ["documents", "images"];
    const allowedTypes = new Set<string>();
    if (categories.includes("documents")) {
      allowedTypes.add("application/pdf");
      allowedTypes.add("application/msword");
      allowedTypes.add("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
    if (categories.includes("images")) {
      allowedTypes.add("image/png");
      allowedTypes.add("image/jpeg");
      allowedTypes.add("image/webp");
    }
    if (!allowedTypes.has(normalizeText(upload.file_type, 200))) throw new Error(`Upload type is not allowed: ${fieldId}`);
  }
}

async function handleLoad(body: Record<string, unknown>) {
  const token = normalizeText(body.token, 500);
  if (!token) return unavailable();
  const result = await assertUsableInvitation(token);
  if (!result.ok) return result.response;
  return respond(200, {
    title: result.form.title,
    description: result.form.description,
    schema: result.assignment.schema_snapshot,
    company_id: result.assignment.company_id,
    candidate_id: result.assignment.candidate_id,
    candidate_name: result.candidate.name,
    expires_at: result.assignment.expires_at,
  });
}

async function handleSubmit(body: Record<string, unknown>) {
  const token = normalizeText(body.token, 500);
  if (!token) return unavailable();
  const result = await assertUsableInvitation(token);
  if (!result.ok) return result.response;
  const consent = consentPayload(body, "data_protection");
  if (!consent.accepted || !consent.consentText) {
    return respond(400, { error: "You must agree to the data protection policies to continue" });
  }

  const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? body.answers as Record<string, unknown>
    : {};
  const uploadRows = Array.isArray(body.upload_rows)
    ? body.upload_rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    : [];

  validateAnswers(result.assignment.schema_snapshot, answers);
  validateUploads(result.assignment.schema_snapshot, uploadRows);

  const submissionId = crypto.randomUUID();
  const { error: submissionError } = await admin.from("lead_form_submissions").insert({
    id: submissionId,
    form_id: result.assignment.form_id,
    company_id: result.assignment.company_id,
    candidate_id: result.assignment.candidate_id,
    assignment_id: result.assignment.id,
    answers,
    schema_snapshot: result.assignment.schema_snapshot,
    status: "new",
  });
  if (submissionError) return respond(409, { error: "This invitation has already been submitted" });

  if (uploadRows.length > 0) {
    const { error: uploadError } = await admin.from("lead_form_uploads").insert(uploadRows.map((upload) => ({
      submission_id: submissionId,
      form_id: result.assignment.form_id,
      company_id: result.assignment.company_id,
      field_id: normalizeText(upload.field_id, 200),
      bucket: normalizeText(upload.bucket, 200),
      object_key: normalizeText(upload.object_key, 1000),
      file_name: normalizeText(upload.file_name, 500),
      file_type: normalizeText(upload.file_type, 200),
      file_size: Number(upload.file_size) || 0,
    })));
    if (uploadError) return respond(400, { error: uploadError.message });
  }

  const { error: consentError } = await admin.rpc("record_consent", {
    _company_id: result.assignment.company_id,
    _consent_key: "data_protection",
    _source_flow: "candidate_assigned_form",
    _consent_text: consent.consentText,
    _candidate_id: result.assignment.candidate_id,
    _application_id: null,
    _submission_id: submissionId,
    _screening_submission_id: null,
    _assignment_id: result.assignment.id,
    _interview_feedback_id: null,
    _page_path: consent.pagePath,
    _metadata: { form_id: result.assignment.form_id },
  });
  if (consentError) return respond(500, { error: "Unable to record consent" });

  await admin
    .from("candidate_form_assignments")
    .update({ status: "completed", completed_at: new Date().toISOString(), access_token_hash: null })
    .eq("id", result.assignment.id)
    .eq("status", "pending");

  return respond(200, { ok: true });
}

async function createOrResendInvitation(req: Request, args: {
  profile: AuthenticatedProfile;
  form: LeadFormRow;
  company: CompanyRow | null;
  candidate: CandidateRow;
}) {
  const { data: existingRows } = await admin
    .from("candidate_form_assignments")
    .select("*")
    .eq("form_id", args.form.id)
    .eq("candidate_id", args.candidate.id)
    .in("status", ["pending", "completed", "verified"]);
  const existing = ((existingRows ?? []) as AssignmentRow[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const token = randomToken();
  const token_hash = await hash(token);
  let assignmentId = existing?.id ?? "";
  let mode: "created" | "resent" | "skipped_existing" = "created";

  if (existing?.status === "completed" || existing?.status === "verified") {
    return { mode: "skipped_existing" as const, emailOk: true };
  }

  if (existing?.status === "pending" && !isExpired(existing.expires_at)) {
    const { error } = await admin
      .from("candidate_form_assignments")
      .update({ token_hash })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    assignmentId = existing.id;
    mode = "resent";
  } else {
    if (existing?.status === "pending" && isExpired(existing.expires_at)) {
      await admin.from("candidate_form_assignments").update({ status: "expired" }).eq("id", existing.id);
    }
    const { data, error } = await admin
      .from("candidate_form_assignments")
      .insert({
        company_id: args.profile.companyId,
        form_id: args.form.id,
        candidate_id: args.candidate.id,
        created_by: args.profile.userId,
        token_hash,
        schema_snapshot: args.form.schema,
        expires_at: addDays(DEFAULT_EXPIRY_DAYS),
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not create invitation");
    assignmentId = data.id;
  }

  const email = await sendInvitationEmail(req, { company: args.company, candidate: args.candidate, form: args.form, token, assignmentId });
  return { mode, emailOk: email.ok };
}

async function handleSendInvites(req: Request, body: Record<string, unknown>) {
  const auth = await requireAuthenticatedProfile(req);
  if (!auth.ok) return auth.response;

  const formId = normalizeText(body.form_id, 80);
  const candidateIds = Array.isArray(body.candidate_ids)
    ? Array.from(new Set(body.candidate_ids.map((id) => normalizeText(id, 80)).filter(Boolean)))
    : [];
  if (!formId || candidateIds.length === 0) return respond(400, { error: "form_id and candidate_ids are required" });

  const form = await loadForm(formId, auth.profile.companyId);
  if (!form || form.status !== "active" || form.deleted_at) return respond(400, { error: "Active form not found" });

  const company = await loadCompany(auth.profile.companyId);
  if (company?.status !== "active") return respond(403, { error: "Company is unavailable" });

  const { data: candidatesData, error: candidatesError } = await admin
    .from("candidates")
    .select("id, company_id, name, email")
    .in("id", candidateIds)
    .eq("company_id", auth.profile.companyId);
  if (candidatesError) return respond(500, { error: "Could not load candidates" });

  const candidates = (candidatesData ?? []) as CandidateRow[];
  let created = 0;
  let resent = 0;
  let skipped_existing = 0;
  let skipped_invalid_email = candidateIds.length - candidates.length;
  let failed_email = 0;

  for (const candidate of candidates) {
    if (!isValidEmail(candidate.email)) {
      skipped_invalid_email += 1;
      continue;
    }
    try {
      const result = await createOrResendInvitation(req, { profile: auth.profile, form, company, candidate });
      if (result.mode === "created") created += 1;
      if (result.mode === "resent") resent += 1;
      if (result.mode === "skipped_existing") skipped_existing += 1;
      if (!result.emailOk) failed_email += 1;
    } catch {
      failed_email += 1;
    }
  }

  return respond(200, { ok: true, created, resent, skipped_existing, skipped_invalid_email, failed_email });
}

async function loadAssignmentForCompany(assignmentId: string, companyId: string) {
  const { data } = await admin
    .from("candidate_form_assignments")
    .select("*, lead_forms(*), candidates(id, company_id, name, email)")
    .eq("id", assignmentId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const assignment = data as AssignmentRow & {
    lead_forms?: LeadFormRow | LeadFormRow[] | null;
    candidates?: CandidateRow | CandidateRow[] | null;
  };
  return { assignment, form: firstRelated(assignment.lead_forms), candidate: firstRelated(assignment.candidates) };
}

async function handleResend(req: Request, body: Record<string, unknown>) {
  const auth = await requireAuthenticatedProfile(req);
  if (!auth.ok) return auth.response;
  const assignmentId = normalizeText(body.assignment_id, 80);
  const loaded = await loadAssignmentForCompany(assignmentId, auth.profile.companyId);
  if (!loaded?.assignment || !loaded.form || !loaded.candidate) return unavailable();
  if (loaded.assignment.status !== "pending" || isExpired(loaded.assignment.expires_at)) return respond(400, { error: "Only pending, unexpired invitations can be resent" });

  const token = randomToken();
  await admin.from("candidate_form_assignments").update({ token_hash: await hash(token) }).eq("id", loaded.assignment.id);
  const company = await loadCompany(auth.profile.companyId);
  const email = await sendInvitationEmail(req, { company, candidate: loaded.candidate, form: loaded.form, token, assignmentId: loaded.assignment.id });
  if (!email.ok) return respond(502, { error: email.error });
  return respond(200, { ok: true });
}

async function handleReissue(req: Request, body: Record<string, unknown>) {
  const auth = await requireAuthenticatedProfile(req);
  if (!auth.ok) return auth.response;
  const assignmentId = normalizeText(body.assignment_id, 80);
  const loaded = await loadAssignmentForCompany(assignmentId, auth.profile.companyId);
  if (!loaded?.assignment || !loaded.form || !loaded.candidate) return unavailable();
  if (loaded.form.status !== "active" || loaded.form.deleted_at) return respond(400, { error: "Active form not found" });

  await admin.from("candidate_form_assignments").update({ status: "superseded" }).eq("id", loaded.assignment.id);

  const token = randomToken();
  const { data, error } = await admin
    .from("candidate_form_assignments")
    .insert({
      company_id: auth.profile.companyId,
      form_id: loaded.form.id,
      candidate_id: loaded.candidate.id,
      created_by: auth.profile.userId,
      token_hash: await hash(token),
      schema_snapshot: loaded.form.schema,
      expires_at: addDays(DEFAULT_EXPIRY_DAYS),
      reset_of: loaded.assignment.id,
    })
    .select("id")
    .single();
  if (error || !data) return respond(400, { error: error?.message ?? "Could not reissue invitation" });

  const company = await loadCompany(auth.profile.companyId);
  const email = await sendInvitationEmail(req, { company, candidate: loaded.candidate, form: loaded.form, token, assignmentId: data.id });
  if (!email.ok) return respond(502, { error: email.error });
  return respond(200, { ok: true });
}

async function handleRevoke(body: Record<string, unknown>, req: Request) {
  const auth = await requireAuthenticatedProfile(req);
  if (!auth.ok) return auth.response;
  const assignmentId = normalizeText(body.assignment_id, 80);
  const { error } = await admin
    .from("candidate_form_assignments")
    .update({ status: "revoked" })
    .eq("id", assignmentId)
    .eq("company_id", auth.profile.companyId)
    .eq("status", "pending");
  if (error) return respond(400, { error: error.message });
  return respond(200, { ok: true });
}

async function handleDeleteForm(body: Record<string, unknown>, req: Request) {
  const auth = await requireAuthenticatedProfile(req);
  if (!auth.ok) return auth.response;
  const formId = normalizeText(body.form_id, 80);
  if (!formId) return respond(400, { error: "form_id is required" });

  const { error } = await admin
    .from("lead_forms")
    .delete()
    .eq("id", formId)
    .eq("company_id", auth.profile.companyId);
  if (error) return respond(400, { error: error.message });
  return respond(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = normalizeText(body.action, 80);

    if (action === "load") return await handleLoad(body);
    if (action === "submit") return await handleSubmit(body);
    if (action === "send_invites") return await handleSendInvites(req, body);
    if (action === "resend") return await handleResend(req, body);
    if (action === "reissue") return await handleReissue(req, body);
    if (action === "revoke") return await handleRevoke(body, req);
    if (action === "delete_form") return await handleDeleteForm(body, req);

    return respond(400, { error: "Unsupported action" });
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});
