import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json(401, { error: "Unauthorized" });

    // Caller role check: must be super_admin OR admin of the target company.
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const roles = (callerRoles ?? []).map((r: any) => r.role);
    const isSuper = roles.includes("super_admin");

    const body = await req.json();
    const { action, company_id, target_user_id } = body;

    if (!action || !company_id) return json(400, { error: "Missing action or company_id" });

    if (!isSuper) {
      // Must be admin of the same company.
      if (!roles.includes("admin")) return json(403, { error: "Forbidden" });
      const { data: callerProfile } = await admin
        .from("profiles").select("company_id").eq("user_id", caller.id).maybeSingle();
      if (callerProfile?.company_id !== company_id) return json(403, { error: "Forbidden" });
    }

    // Validate target belongs to company (for non-create actions).
    const requireTarget = async () => {
      if (!target_user_id) throw new Error("Missing target_user_id");
      const { data: targetProfile } = await admin
        .from("profiles").select("user_id, company_id").eq("user_id", target_user_id).maybeSingle();
      if (!targetProfile || targetProfile.company_id !== company_id) {
        throw new Error("Target user not in company");
      }
    };

    switch (action) {
      case "update": {
        await requireTarget();
        const { name, role } = body;
        if (name) {
          const { error } = await admin.from("profiles").update({ name }).eq("user_id", target_user_id);
          if (error) return json(500, { error: error.message });
        }
        if (role && (role === "admin" || role === "recruiter")) {
          // Replace tenant-level role rows (admin/recruiter). Never touch super_admin.
          await admin.from("user_roles").delete()
            .eq("user_id", target_user_id).in("role", ["admin", "recruiter"]);
          const { error: insErr } = await admin.from("user_roles").insert({ user_id: target_user_id, role });
          if (insErr) return json(500, { error: insErr.message });
        }
        return json(200, { success: true });
      }
      case "deactivate": {
        await requireTarget();
        if (target_user_id === caller.id) return json(400, { error: "Cannot deactivate yourself" });
        const { error } = await admin.from("profiles").update({ is_active: false }).eq("user_id", target_user_id);
        if (error) return json(500, { error: error.message });
        // Revoke tenant roles so they cannot sign back in with privileges.
        await admin.from("user_roles").delete()
          .eq("user_id", target_user_id).in("role", ["admin", "recruiter"]);
        return json(200, { success: true });
      }
      case "reactivate": {
        await requireTarget();
        const role: "admin" | "recruiter" = body.role === "admin" ? "admin" : "recruiter";
        const { error } = await admin.from("profiles").update({ is_active: true }).eq("user_id", target_user_id);
        if (error) return json(500, { error: error.message });
        await admin.from("user_roles").delete()
          .eq("user_id", target_user_id).in("role", ["admin", "recruiter"]);
        await admin.from("user_roles").insert({ user_id: target_user_id, role });
        return json(200, { success: true });
      }
      default:
        return json(400, { error: "Unknown action" });
    }
  } catch (err: any) {
    return json(500, { error: err?.message ?? "Internal error" });
  }
});