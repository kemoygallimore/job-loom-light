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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const RESEND = "https://api.resend.com";

async function resend(path: string, init: RequestInit = {}) {
  const res = await fetch(`${RESEND}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function mapRecords(d: any) {
  // Resend domain response shape: { records: [{ record, name, type, value, ttl, status }] }
  return Array.isArray(d?.records) ? d.records : [];
}

function mapStatus(s: string | undefined): string {
  switch (s) {
    case "verified": return "verified";
    case "pending":
    case "not_started":
    case "temporary_failure":
      return "pending";
    case "failed":
      return "failed";
    default:
      return s ? "pending" : "unverified";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, company_id, domain, from_name, reply_to } = body ?? {};
    if (!action || !company_id) {
      return new Response(JSON.stringify({ error: "action and company_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await admin
      .from("companies").select("id, email_domain, email_provider_domain_id").eq("id", company_id).maybeSingle();
    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logEvent = async (act: string, payload: any) => {
      await admin.from("company_email_domain_events").insert({
        company_id, action: act, actor_user_id: user.id, payload,
      });
    };

    if (action === "register") {
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
        return new Response(JSON.stringify({ error: "Valid domain required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await resend("/domains", {
        method: "POST", body: JSON.stringify({ name: domain.toLowerCase() }),
      });
      if (!r.ok) {
        await logEvent("register_failed", r.data);
        return new Response(JSON.stringify({ error: "Resend register failed", details: r.data }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("companies").update({
        email_domain: domain.toLowerCase(),
        email_provider_domain_id: r.data.id,
        email_domain_status: mapStatus(r.data.status),
        email_domain_records: mapRecords(r.data),
        email_domain_last_checked_at: new Date().toISOString(),
        email_from_name: from_name ?? null,
        email_reply_to: reply_to ?? null,
      }).eq("id", company_id);
      await logEvent("registered", { id: r.data.id, status: r.data.status });
      return new Response(JSON.stringify({ ok: true, domain: r.data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_meta") {
      await admin.from("companies").update({
        email_from_name: from_name ?? null,
        email_reply_to: reply_to ?? null,
      }).eq("id", company_id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify" || action === "refresh_status") {
      if (!company.email_provider_domain_id) {
        return new Response(JSON.stringify({ error: "No domain registered" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "verify") {
        await resend(`/domains/${company.email_provider_domain_id}/verify`, { method: "POST" });
      }
      const g = await resend(`/domains/${company.email_provider_domain_id}`, { method: "GET" });
      if (!g.ok) {
        await logEvent("refresh_failed", g.data);
        return new Response(JSON.stringify({ error: "Resend lookup failed", details: g.data }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const status = mapStatus(g.data.status);
      await admin.from("companies").update({
        email_domain_status: status,
        email_domain_records: mapRecords(g.data),
        email_domain_last_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
      await logEvent(action === "verify" ? "verified" : "refreshed", { status: g.data.status });
      return new Response(JSON.stringify({ ok: true, status, domain: g.data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      if (company.email_provider_domain_id) {
        await resend(`/domains/${company.email_provider_domain_id}`, { method: "DELETE" });
      }
      await admin.from("companies").update({
        email_domain: null,
        email_provider_domain_id: null,
        email_domain_status: "unverified",
        email_domain_records: null,
        email_domain_last_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
      await logEvent("removed", {});
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
