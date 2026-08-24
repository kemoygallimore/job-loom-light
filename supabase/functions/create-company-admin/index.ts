import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authorizeCreateCompanyUser, type TenantRole } from "./permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { company_id, admin_name, admin_email, admin_password } = body;
    const role: "admin" | "recruiter" = body.role === "recruiter" ? "recruiter" : "admin";

    if (!company_id || !admin_name || !admin_email || !admin_password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRoleRows, error: callerRolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (callerRolesError) {
      return new Response(JSON.stringify({ error: "Failed to verify caller role: " + callerRolesError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerRoles = (callerRoleRows ?? [])
      .map((row: { role: string }) => row.role)
      .filter((value: string): value is TenantRole =>
        value === "admin" || value === "recruiter" || value === "super_admin"
      );

    let callerCompanyId: string | null = null;
    if (!callerRoles.includes("super_admin")) {
      const { data: callerProfile, error: callerProfileError } = await adminClient
        .from("profiles")
        .select("company_id")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (callerProfileError) {
        return new Response(JSON.stringify({ error: "Failed to verify caller company: " + callerProfileError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      callerCompanyId = callerProfile?.company_id ?? null;
    }

    const authorization = authorizeCreateCompanyUser({
      callerRoles,
      callerCompanyId,
      targetCompanyId: company_id,
      targetRole: role,
    });

    if (!authorization.allowed) {
      return new Response(JSON.stringify({ error: authorization.error }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Seat enforcement: count active profiles vs. seat limit.
    try {
      const { data: seatLimit } = await adminClient.rpc("get_company_seat_limit", { _company_id: company_id });
      const { data: usedSeats } = await adminClient.rpc("count_active_company_seats", { _company_id: company_id });
      if (typeof seatLimit === "number" && typeof usedSeats === "number" && usedSeats >= seatLimit) {
        return new Response(
          JSON.stringify({ error: `Seat limit reached (${usedSeats}/${seatLimit}). Add seats via Add-ons.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (_) { /* if RPCs missing, skip enforcement */ }

    // Create auth user with service role (won't affect caller's session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? "Failed to create user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({ user_id: newUser.user.id, company_id, name: admin_name, email: admin_email });

    if (profileError) {
      return new Response(JSON.stringify({ error: "Failed to create profile: " + profileError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Assign role (admin or recruiter)
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });

    if (roleError) {
      return new Response(JSON.stringify({ error: "Failed to assign role: " + roleError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Seed a billing profile row so invoicing has a bill-to identity.
    // Idempotent: upsert by company_id; preserves existing fields if already set.
    const { data: companyRow } = await adminClient
      .from("companies")
      .select("name")
      .eq("id", company_id)
      .maybeSingle();

    await adminClient
      .from("company_billing_profiles")
      .upsert(
        {
          company_id,
          legal_name: companyRow?.name ?? null,
          billing_email: admin_email,
          billing_contact_name: admin_name,
        },
        { onConflict: "company_id", ignoreDuplicates: false },
      );

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
