// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Unauthorized" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: { user: caller } = {} } = await userClient.auth.getUser();
    if (!caller) return json(401, { error: "Unauthorized" });

    // Role check
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map((r: any) => r.role);
    const isSuper = roles.includes("super_admin");

    const body = await req.json().catch(() => ({} as any));
    const { ids, filter, company_id, dryRun = false, chunkSize = 200 } = body ?? {};

    if (!company_id) return json(400, { error: "company_id is required" });

    if (!isSuper) {
      if (!roles.includes("admin")) return json(403, { error: "Forbidden" });
      const { data: callerProfile } = await admin
        .from("profiles")
        .select("company_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerProfile || callerProfile.company_id !== company_id) return json(403, { error: "Forbidden" });
    }

    // Determine target application IDs
    let targetIds: string[] = [];
    if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids;
    } else {
      let q = admin.from("applications").select("id").eq("company_id", company_id);
      if (filter) {
        if (filter.job_id) q = q.eq("job_id", filter.job_id);
        if (filter.stage) q = q.eq("stage", filter.stage);
        if (filter.older_than_days) {
          const cutoff = new Date(Date.now() - (filter.older_than_days * 24 * 60 * 60 * 1000)).toISOString();
          q = q.lt("created_at", cutoff);
        }
      }
      const { data: rows, error: rowsErr } = await q;
      if (rowsErr) return json(500, { error: rowsErr.message });
      targetIds = (rows ?? []).map((r: any) => r.id);
    }

    if (targetIds.length === 0) return json(200, { ok: true, total: 0 });
    if (dryRun) return json(200, { ok: true, total: targetIds.length });

    // Create bulk_actions row
    const { data: bulkRow, error: bulkErr } = await admin
      .from("bulk_actions")
      .insert([{ company_id, initiated_by: caller.id, filter_json: filter ?? null, total_count: targetIds.length, processed_count: 0, status: "processing", started_at: new Date().toISOString() }])
      .select()
      .maybeSingle();

    if (bulkErr || !bulkRow) return json(500, { error: bulkErr?.message ?? "Failed to create bulk_action" });
    const bulkActionId = (bulkRow as any).id;

    // Process in chunks
    try {
      for (let i = 0; i < targetIds.length; i += chunkSize) {
        const chunk = targetIds.slice(i, i + chunkSize);

        const { data: apps, error: selErr } = await admin
          .from("applications")
          .select("id, stage")
          .in("id", chunk as any[]);
        if (selErr) throw selErr;

        const audits = (apps ?? []).map((a: any) => ({
          bulk_action_id: bulkActionId,
          application_id: a.id,
          old_stage: a.stage,
          new_stage: "rejected",
          changed_by: caller.id,
          created_at: new Date().toISOString(),
        }));

        const { error: auditErr } = await admin.from("application_audit").insert(audits);
        if (auditErr) throw auditErr;

        const { error: updErr } = await admin.from("applications").update({ stage: "rejected" }).in("id", chunk as any[]);
        if (updErr) throw updErr;

        const processed = Math.min(i + chunkSize, targetIds.length);
        await admin.from("bulk_actions").update({ processed_count: processed }).eq("id", bulkActionId);
      }

      await admin.from("bulk_actions").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", bulkActionId);
      return json(200, { ok: true, bulk_action_id: bulkActionId, total: targetIds.length });
    } catch (err: any) {
      await admin.from("bulk_actions").update({ status: "failed", error_count: 1 }).eq("id", bulkActionId);
      return json(500, { error: err?.message ?? String(err) });
    }
  } catch (err: any) {
    return json(500, { error: err?.message ?? "Internal error" });
  }
});
