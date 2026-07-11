import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDRESS = Deno.env.get("RIZONHIRE_FROM_EMAIL") ?? "RizonHire <no-reply@rizonhire.com>";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });
  try {
    const body = await req.json(); const action = String(body.action ?? ""); const tokenHash = await hash(String(body.token ?? ""));
    const { data: assignment } = await admin.from("candidate_form_assignments").select("*, lead_forms(title), candidates(email, name)").eq("token_hash", tokenHash).maybeSingle();
    if (!assignment || new Date(assignment.expires_at) <= new Date() || ["completed", "revoked", "expired"].includes(assignment.status)) return respond(404, { error: "This form invitation is unavailable" });
    const candidate = Array.isArray(assignment.candidates) ? assignment.candidates[0] : assignment.candidates;
    const form = Array.isArray(assignment.lead_forms) ? assignment.lead_forms[0] : assignment.lead_forms;
    if (!candidate?.email) return respond(400, { error: "Candidate email is missing" });

    if (action === "request_code") {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count } = await admin.from("candidate_form_verifications").select("id", { count: "exact", head: true }).eq("assignment_id", assignment.id).gte("created_at", since);
      if ((count ?? 0) >= 3) return respond(429, { error: "Too many code requests. Try again later." });
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      await admin.from("candidate_form_verifications").insert({ assignment_id: assignment.id, code_hash: await hash(code), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      if (!RESEND_API_KEY) return respond(503, { error: "Email delivery is not configured" });
      const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM_ADDRESS, to: [candidate.email], subject: "Your RizonHire verification code", html: `<p>Hello ${String(candidate.name ?? "candidate")},</p><p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>` }) });
      if (!emailResponse.ok) return respond(502, { error: "Unable to send verification email" });
      return respond(200, { ok: true });
    }

    if (action === "verify") {
      const { data: verification } = await admin.from("candidate_form_verifications").select("*").eq("assignment_id", assignment.id).is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!verification || new Date(verification.expires_at) <= new Date() || verification.attempt_count >= 5) return respond(400, { error: "The verification code has expired" });
      if (verification.code_hash !== await hash(String(body.code ?? ""))) { await admin.from("candidate_form_verifications").update({ attempt_count: verification.attempt_count + 1 }).eq("id", verification.id); return respond(400, { error: "Incorrect verification code" }); }
      const accessToken = randomToken();
      await Promise.all([
        admin.from("candidate_form_verifications").update({ consumed_at: new Date().toISOString() }).eq("id", verification.id),
        admin.from("candidate_form_assignments").update({ status: "verified", verified_at: new Date().toISOString(), access_token_hash: await hash(accessToken) }).eq("id", assignment.id),
      ]);
      return respond(200, { access_token: accessToken, title: form?.title ?? "Candidate form", schema: assignment.schema_snapshot });
    }

    if (action === "submit") {
      if (!assignment.access_token_hash || assignment.access_token_hash !== await hash(String(body.access_token ?? "")) || assignment.status !== "verified") return respond(403, { error: "Verify your email before submitting" });
      const submissionId = crypto.randomUUID();
      const { error } = await admin.from("lead_form_submissions").insert({ id: submissionId, form_id: assignment.form_id, company_id: assignment.company_id, candidate_id: assignment.candidate_id, assignment_id: assignment.id, answers: body.answers ?? {}, schema_snapshot: assignment.schema_snapshot });
      if (error) return respond(400, { error: error.message });
      await admin.from("candidate_form_assignments").update({ status: "completed", completed_at: new Date().toISOString(), access_token_hash: null }).eq("id", assignment.id);
      return respond(200, { ok: true });
    }
    return respond(400, { error: "Unsupported action" });
  } catch (error) { return respond(500, { error: error instanceof Error ? error.message : "Unexpected error" }); }
});
