// Supabase Edge Function: get-export-download-url
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

async function authenticate(req: Request) {
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
  if (companyRes.error || adminRes.error || !companyRes.data) return null;

  return { userId: data.user.id, companyId: companyRes.data as string, isAdmin: Boolean(adminRes.data) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await authenticate(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);

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
    if (job.company_id !== auth.companyId || (job.requested_by !== auth.userId && !auth.isAdmin)) {
      return json({ error: "Forbidden" }, 403);
    }
    if (job.status !== "completed" || !job.r2_bucket || !job.r2_key) {
      return json({ error: "Export file is not available" }, 400);
    }
    if (job.deleted_at || job.status === "deleted") return json({ error: "Export file has been deleted" }, 410);
    if (job.expires_at && new Date(job.expires_at).getTime() <= Date.now()) {
      return json({ error: "Export file has expired" }, 410);
    }

    const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
    const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");
    if (!R2_WORKER_BASE_URL || !R2_WORKER_SECRET) return json({ error: "Server misconfigured" }, 500);

    const workerRes = await fetch(`${R2_WORKER_BASE_URL.replace(/\/+$/, "")}/exports/sign-download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${R2_WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucket: job.r2_bucket, key: job.r2_key }),
    });
    if (!workerRes.ok) {
      const text = await workerRes.text().catch(() => "");
      console.error("export download signing failed", workerRes.status, text);
      return json({ error: "Failed to get download URL" }, 500);
    }

    const workerJson = await workerRes.json();
    if (!workerJson?.url) return json({ error: "Worker returned no URL" }, 500);

    await admin
      .from("export_jobs")
      .update({
        download_count: Number(job.download_count ?? 0) + 1,
        last_downloaded_by: auth.userId,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return json({ url: workerJson.url, expires_in: workerJson.expires_in ?? null });
  } catch (err) {
    console.error("get-export-download-url fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});
