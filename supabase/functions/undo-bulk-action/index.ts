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

// Config
const UNDO_WINDOW_DAYS = Number(Deno.env.get("UNDO_WINDOW_DAYS") ?? "7");
const UNDO_MAX_ROWS = Number(Deno.env.get("UNDO_MAX_ROWS") ?? "10000");

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
    const { bulk_action_id, company_id } = body ?? {};

    if (!bulk_action_id) return json(400, { error: "bulk_action_id is required" });
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

    // Fetch bulk_action
    const { data: bulk, error: bulkErr } = await admin
      .from("bulk_actions")
      .select("id, company_id, status, finished_at")
      .eq("id", bulk_action_id)
      .maybeSingle();
    if (bulkErr) return json(500, { error: bulkErr.message });
    if (!bulk) return json(404, { error: "bulk_action not found" });
    if (bulk.company_id !== company_id) return json(403, { error: "Forbidden" });
    if (bulk.status !== "completed") return json(400, { error: "Can only undo a completed bulk action" });

    const finishedAt = bulk.finished_at ? new Date(bulk.finished_at) : null;
    if (!finishedAt) return json(400, { error: "Invalid finished_at on bulk_action" });
    const ageMs = Date.now() - finishedAt.getTime();
    if (ageMs > UNDO_WINDOW_DAYS * 24 * 60 * 60 * 1000) return json(400, { error: "Undo window expired" });

    // Fetch audits
    const { data: audits, error: auditErr } = await admin
      .from("application_audit")
      .select("application_id, old_stage")
      .eq("bulk_action_id", bulk_action_id);
    if (auditErr) return json(500, { error: auditErr.message });
    const total = (audits ?? []).length;
    if (total === 0) return json(200, { ok: true, reverted_count: 0, bulk_action_id });
    if (total > UNDO_MAX_ROWS) return json(400, { error: "Too many rows to undo" });

    // Prefer running a server-side transactional function if available
    try {
      const { data: rpcResult, error: rpcErr } = await admin.rpc("undo_bulk_action", { p_bulk_action_id: bulk_action_id });
      if (rpcErr) {
        // Fallback to client-side grouped updates if RPC not available
        const groups: Record<string, string[]> = {};
        for (const a of audits as any[]) {
          const s = a.old_stage ?? "applied";
          groups[s] = groups[s] ?? [];
          groups[s].push(a.application_id);
        }
        for (const [oldStage, ids] of Object.entries(groups)) {
          const { error: updErr } = await admin.from("applications").update({ stage: oldStage }).in("id", ids as any[]);
          if (updErr) throw updErr;
        }
        await admin.from("bulk_actions").update({ status: "undone", finished_at: new Date().toISOString() }).eq("id", bulk_action_id);
        return json(200, { ok: true, reverted_count: total, bulk_action_id });
      }
      const reverted = (rpcResult as any) ?? 0;
      return json(200, { ok: true, reverted_count: reverted, bulk_action_id });
    } catch (err: any) {
      return json(500, { error: err?.message ?? String(err) });
    }
  } catch (err: any) {
    return json(500, { error: err?.message ?? "Internal error" });
  }
});
