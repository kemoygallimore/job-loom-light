import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffISO = cutoff.toISOString();

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

        // Delete video files from storage
        const { data: subs } = await supabase
          .from("screening_submissions")
          .select("video_url")
          .eq("screening_job_id", job.id);

        if (subs) {
          const filePaths = subs
            .map((s: any) => {
              try {
                const url = new URL(s.video_url);
                const parts = url.pathname.split("/screening-videos/");
                return parts[1] || null;
              } catch {
                return null;
              }
            })
            .filter(Boolean) as string[];

          if (filePaths.length > 0) {
            await supabase.storage.from("screening-videos").remove(filePaths);
          }
        }

        // Delete the job (cascade deletes submissions)
        await supabase.from("screening_jobs").delete().eq("id", job.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: oldJobs?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
