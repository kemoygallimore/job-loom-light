// Supabase Edge Function: get-invoice-download-url
// Deploy via Supabase Dashboard → Edge Functions → Open Editor (external Supabase project).
//
// Required secrets (Edge Functions → Secrets):
//   R2_WORKER_BASE_URL = https://api.rizonhire.com
//   R2_WORKER_SECRET   = <Cloudflare Worker shared secret>
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
    const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");

    if (!R2_WORKER_BASE_URL || !R2_WORKER_SECRET) {
      console.error("Missing R2 worker env vars");
      return json({ error: "Server misconfigured" }, 500);
    }

    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // --- Input ---
    const body = await req.json().catch(() => null);
    const invoice_id = body?.invoice_id;
    if (!invoice_id || typeof invoice_id !== "string") {
      return json({ error: "invoice_id is required" }, 400);
    }

    // --- Load invoice (service role) ---
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("id, company_id, pdf_r2_key")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr) {
      console.error("invoice fetch error", invErr);
      return json({ error: "Failed to load invoice" }, 500);
    }
    if (!invoice) return json({ error: "Invoice not found" }, 404);

    // --- Access check: super-admin OR same company ---
    const { data: isSuper, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (roleErr) {
      console.error("has_role error", roleErr);
      return json({ error: "Authorization check failed" }, 500);
    }

    let allowed = !!isSuper;
    if (!allowed) {
      const { data: userCompanyId, error: cidErr } = await userClient.rpc(
        "get_user_company_id",
        { _user_id: userId },
      );
      if (cidErr) {
        console.error("get_user_company_id error", cidErr);
        return json({ error: "Authorization check failed" }, 500);
      }
      allowed = userCompanyId && userCompanyId === invoice.company_id;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    if (!invoice.pdf_r2_key) {
      return json({ error: "PDF has not been generated yet." }, 400);
    }

    // --- Ask Worker for signed URL ---
    const url = `${R2_WORKER_BASE_URL}/invoices/${encodeURIComponent(invoice.id)}/download?key=${encodeURIComponent(invoice.pdf_r2_key)}`;
    const workerRes = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${R2_WORKER_SECRET}` },
    });

    if (!workerRes.ok) {
      const text = await workerRes.text();
      console.error("Worker download failed", workerRes.status, text);
      return json({ error: "Failed to get download URL" }, 500);
    }

    const workerJson = await workerRes.json();
    if (!workerJson?.url) {
      console.error("Worker missing url", workerJson);
      return json({ error: "Worker returned no URL" }, 500);
    }

    return json({ url: workerJson.url, expires_in: workerJson.expires_in ?? null });
  } catch (err) {
    console.error("get-invoice-download-url fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});
