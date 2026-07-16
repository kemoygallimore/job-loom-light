// Supabase Edge Function: delete-export-file
//
// Required secrets:
//   R2_WORKER_BASE_URL = https://api.rizonhire.com
//   R2_WORKER_SECRET   = <Cloudflare Worker shared secret>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticateAdmin(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;

  const [companyRes, adminRes] = await Promise.all([
    userClient.rpc("get_user_company_id", { _user_id: data.user.id }),
    userClient.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
  ]);
  if (companyRes.error || adminRes.error || !companyRes.data || !adminRes.data) return null;
  return { userId: data.user.id, companyId: companyRes.data as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await authenticateAdmin(req);
    if (!auth) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const exportJobId = body?.export_job_id;
    if (!exportJobId || typeof exportJobId !== "string") return json({ error: "export_job_id is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: job, error } = await admin
      .from("export_jobs")
      .select("*")
      .eq("id", exportJobId)
      .maybeSingle();
    if (error) throw error;
    if (!job) return json({ error: "Export not found" }, 404);
    if (job.company_id !== auth.companyId) return json({ error: "Forbidden" }, 403);

    if (job.r2_bucket && job.r2_key && job.status === "completed") {
      const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
      const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");
      if (!R2_WORKER_BASE_URL || !R2_WORKER_SECRET) return json({ error: "Server misconfigured" }, 500);

      const workerRes = await fetch(`${R2_WORKER_BASE_URL.replace(/\/+$/, "")}/exports/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${R2_WORKER_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucket: job.r2_bucket, key: job.r2_key }),
      });
      if (!workerRes.ok) {
        const text = await workerRes.text().catch(() => "");
        console.error("export delete failed", workerRes.status, text);
        return json({ error: "Failed to delete export file" }, 500);
      }
    }

    const { data: updated, error: updateError } = await admin
      .from("export_jobs")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return json({ success: true, job: updated });
  } catch (err) {
    console.error("delete-export-file fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});
