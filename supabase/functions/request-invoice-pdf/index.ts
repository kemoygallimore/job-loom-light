// Supabase Edge Function: request-invoice-pdf
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

    // --- Super-admin check (reuse existing has_role RPC) ---
    const { data: isSuper, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (roleErr) {
      console.error("has_role error", roleErr);
      return json({ error: "Authorization check failed" }, 500);
    }
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    // --- Input ---
    const body = await req.json().catch(() => null);
    const invoice_id = body?.invoice_id;
    if (!invoice_id || typeof invoice_id !== "string") {
      return json({ error: "invoice_id is required" }, 400);
    }

    // --- Data fetch (service role; user has already been authorized) ---
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr) {
      console.error("invoice fetch error", invErr);
      return json({ error: "Failed to load invoice" }, 500);
    }
    if (!invoice) return json({ error: "Invoice not found" }, 404);

    const { data: lineItems, error: liErr } = await admin
      .from("invoice_line_items")
      .select("description, quantity, unit_price_cents, amount_cents, source")
      .eq("invoice_id", invoice_id);
    if (liErr) {
      console.error("line items fetch error", liErr);
      return json({ error: "Failed to load line items" }, 500);
    }

    const { data: company, error: cErr } = await admin
      .from("companies")
      .select("name, email, address")
      .eq("id", invoice.company_id)
      .maybeSingle();
    if (cErr) {
      console.error("company fetch error", cErr);
      return json({ error: "Failed to load company" }, 500);
    }
    if (!company) return json({ error: "Company not found" }, 404);

    // --- Worker payload ---
    const payload = {
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      invoice_number: invoice.invoice_number,
      payload: {
        company: {
          name: company.name,
          email: company.email ?? null,
          address: company.address ?? null,
        },
        invoice: {
          company_id: invoice.company_id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          currency: invoice.currency,
          subtotal_cents: invoice.subtotal_cents,
          discount_cents: invoice.discount_cents,
          total_cents: invoice.total_cents,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          issued_at: invoice.issued_at,
          due_at: invoice.due_at,
          pdf_version: invoice.pdf_version ?? 0,
        },
        line_items: (lineItems ?? []).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          amount_cents: item.amount_cents,
          source: item.source,
        })),
      },
    };

    // --- Call Cloudflare Worker ---
    const workerRes = await fetch(`${R2_WORKER_BASE_URL}/invoices/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${R2_WORKER_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!workerRes.ok) {
      const text = await workerRes.text();
      console.error("Worker generate-pdf failed", workerRes.status, text);
      return json({ error: "PDF generation failed" }, 500);
    }

    const workerJson = await workerRes.json();
    const pdf_r2_key: string | undefined = workerJson?.pdf_r2_key;
    const pdf_version: number | undefined = workerJson?.pdf_version;
    if (!pdf_r2_key) {
      console.error("Worker missing pdf_r2_key", workerJson);
      return json({ error: "PDF generation returned no key" }, 500);
    }

    const { data: updated, error: upErr } = await admin
      .from("invoices")
      .update({
        pdf_r2_key,
        pdf_version: pdf_version ?? (invoice.pdf_version ?? 0) + 1,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id)
      .select("*")
      .single();
    if (upErr) {
      console.error("invoice update error", upErr);
      return json({ error: "Failed to update invoice" }, 500);
    }

    return json({ success: true, invoice: updated });
  } catch (err) {
    console.error("request-invoice-pdf fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});
