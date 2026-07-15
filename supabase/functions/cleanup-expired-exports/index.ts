// Supabase Edge Function: cleanup-expired-exports
//
// Required secrets:
//   CRON_SECRET        = <shared scheduler secret>
//   R2_WORKER_BASE_URL = https://api.rizonhire.com
//   R2_WORKER_SECRET   = <Cloudflare Worker shared secret>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return json({ error: "CRON_SECRET not configured" }, 500);
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
  const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");
  if (!R2_WORKER_BASE_URL || !R2_WORKER_SECRET) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: jobs, error } = await admin
    .from("export_jobs")
    .select("id,r2_bucket,r2_key")
    .eq("status", "completed")
    .lt("expires_at", new Date().toISOString())
    .not("r2_key", "is", null);

  if (error) {
    console.error("cleanup-expired-exports fetch failed", error);
    return json({ error: "Failed to load expired exports" }, 500);
  }

  const deleted: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const job of jobs ?? []) {
    const workerRes = await fetch(`${R2_WORKER_BASE_URL.replace(/\/+$/, "")}/exports/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${R2_WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucket: job.r2_bucket, key: job.r2_key }),
    });

    if (!workerRes.ok) {
      failed.push({ id: job.id, error: await workerRes.text().catch(() => "Delete failed") });
      continue;
    }

    const { error: updateError } = await admin
      .from("export_jobs")
      .update({
        status: "expired",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (updateError) {
      failed.push({ id: job.id, error: updateError.message });
      continue;
    }
    deleted.push(job.id);
  }

  return json({ success: failed.length === 0, deleted, failed });
});
