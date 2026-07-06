import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const DEFAULT_R2_WORKER_BASE_URL = "https://api.rizonhire.com";
const DEFAULT_VIDEO_BUCKET = "silverweb-ats-videos";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authorize(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return json({ error: "CRON_SECRET not configured" }, 500);
  if (req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  return null;
}

function getR2Target(submission: {
  video_bucket?: string | null;
  video_object_key?: string | null;
  video_url?: string | null;
}) {
  const key = (submission.video_object_key || submission.video_url || "").trim();
  if (!key || /^https?:\/\//i.test(key)) return null;
  return {
    bucket: submission.video_bucket || DEFAULT_VIDEO_BUCKET,
    key,
  };
}

async function deleteR2Objects(
  submissions: Array<{ video_bucket?: string | null; video_object_key?: string | null; video_url?: string | null }>,
) {
  const workerBaseUrl = (Deno.env.get("R2_WORKER_BASE_URL") || DEFAULT_R2_WORKER_BASE_URL).replace(/\/+$/, "");
  const workerSecret = Deno.env.get("R2_WORKER_SECRET");
  const byBucket = new Map<string, Set<string>>();

  for (const submission of submissions) {
    const target = getR2Target(submission);
    if (!target) continue;
    const keys = byBucket.get(target.bucket) ?? new Set<string>();
    keys.add(target.key);
    byBucket.set(target.bucket, keys);
  }

  let deleted = 0;
  for (const [bucket, keysSet] of byBucket) {
    const keys = Array.from(keysSet);
    if (keys.length === 0) continue;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (workerSecret) headers.Authorization = `Bearer ${workerSecret}`;

    const res = await fetch(`${workerBaseUrl}/delete-object`, {
      method: "POST",
      headers,
      body: JSON.stringify({ bucket, keys }),
    });

    if (!res.ok && res.status !== 404) {
      const details = await res.text().catch(() => "");
      throw new Error(`R2 delete failed for ${bucket}: ${res.status} ${details}`.trim());
    }
    deleted += keys.length;
  }

  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authError = authorize(req);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffISO = cutoff.toISOString();
    let deletedVideoObjects = 0;

    // 1. Find old screening jobs
    const { data: oldJobs } = await supabase
      .from("screening_jobs")
      .select("id, title, company_id")
      .lt("created_at", cutoffISO);

    if (oldJobs && oldJobs.length > 0) {
      for (const job of oldJobs) {
        // Count submissions for analytics
        const { count } = await supabase
          .from("screening_submissions")
          .select("*", { count: "exact", head: true })
          .eq("screening_job_id", job.id);

        // Store analytics
        await supabase.from("screening_analytics").insert({
          company_id: job.company_id,
          screening_job_id: job.id,
          job_title: job.title,
          total_submissions: count || 0,
        });

        // Delete video files from Cloudflare R2 before removing database rows.
        const { data: subs } = await supabase
          .from("screening_submissions")
          .select("video_bucket, video_object_key, video_url")
          .eq("screening_job_id", job.id);

        if (subs) {
          deletedVideoObjects += await deleteR2Objects(subs);
        }

        // Delete the job (cascade deletes submissions)
        await supabase.from("screening_jobs").delete().eq("id", job.id);
      }
    }

    return json(
      {
        success: true,
        cleaned: oldJobs?.length || 0,
        deletedVideoObjects,
      },
    );
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
