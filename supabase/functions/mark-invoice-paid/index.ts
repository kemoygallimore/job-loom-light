// Supabase Edge Function: mark-invoice-paid
// Super-admin only. Marks an invoice as paid with payment_method/reference,
// advances the company subscription's renewal_date if this invoice covers
// the current renewal cycle, logs an event, and sends a receipt email.
//
// Required secrets: RESEND_API_KEY
// Optional: RESEND_FROM, R2_WORKER_BASE_URL, R2_WORKER_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: any): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Billing <onboarding@resend.dev>";

    // --- Auth: super_admin only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const { data: isSuper } = await userClient.rpc("has_role", {
      _user_id: userId, _role: "super_admin",
    });
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    // --- Input ---
    const body = await req.json().catch(() => null);
    const invoice_id: string | undefined = body?.invoice_id;
    const payment_method: string | null = body?.payment_method ?? null;
    const payment_reference: string | null = body?.payment_reference ?? null;
    const paid_at: string = body?.paid_at
      ? new Date(body.paid_at).toISOString()
      : new Date().toISOString();
    const sendReceipt: boolean = body?.send_receipt !== false;

    if (!invoice_id) return json({ error: "invoice_id is required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: invoice, error: invErr } = await admin
      .from("invoices").select("*").eq("id", invoice_id).maybeSingle();
    if (invErr) return json({ error: "Failed to load invoice" }, 500);
    if (!invoice) return json({ error: "Invoice not found" }, 404);
    if (invoice.status === "paid") return json({ error: "Invoice already paid" }, 400);
    if (invoice.status === "void") return json({ error: "Cannot mark a void invoice paid" }, 400);
    if (invoice.status === "draft") return json({ error: "Issue the invoice before marking paid" }, 400);

    // --- Update invoice ---
    const { error: upErr } = await admin.from("invoices").update({
      status: "paid",
      paid_at,
      payment_method,
      payment_reference,
    }).eq("id", invoice_id);
    if (upErr) return json({ error: upErr.message }, 500);

    // --- Advance subscription renewal_date if this invoice covers current cycle ---
    let advanced: { from: string; to: string } | null = null;
    const { data: sub } = await admin
      .from("company_subscriptions").select("*")
      .eq("company_id", invoice.company_id).maybeSingle();
    if (sub?.renewal_date && invoice.period_start === sub.renewal_date && invoice.period_end) {
      await admin.from("company_subscriptions")
        .update({ renewal_date: invoice.period_end })
        .eq("company_id", invoice.company_id);
      advanced = { from: sub.renewal_date, to: invoice.period_end };
    }

    await admin.from("invoice_events").insert({
      invoice_id, actor_user_id: userId, event: "marked_paid",
      meta: { payment_method, payment_reference, paid_at, advanced },
    });

    // --- Send receipt email ---
    let receiptId: string | null = null;
    if (sendReceipt && RESEND_API_KEY && invoice.bill_to_email) {
      const number = invoice.invoice_number ?? invoice.id.slice(0, 8);
      const currency = invoice.currency ?? "USD";
      const total = ((invoice.total_cents ?? 0) / 100).toFixed(2);
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
          <h2 style="margin:0 0 12px;">Payment received — thank you!</h2>
          <p>Hello ${esc(invoice.bill_to_contact_name ?? invoice.bill_to_legal_name ?? "")},</p>
          <p>We have received your payment for invoice <strong>${esc(number)}</strong>.</p>
          <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Amount</td><td><strong>${esc(currency)} ${esc(total)}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Paid on</td><td>${esc(paid_at.slice(0,10))}</td></tr>
            ${payment_method ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Method</td><td>${esc(payment_method)}</td></tr>` : ""}
            ${payment_reference ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Reference</td><td>${esc(payment_reference)}</td></tr>` : ""}
          </table>
          <p style="font-size:12px;color:#888;">Thank you for your business.</p>
        </div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: RESEND_FROM, to: [invoice.bill_to_email],
            subject: `Receipt for invoice ${number}`, html,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          receiptId = j?.id ?? null;
          await admin.from("invoice_events").insert({
            invoice_id, actor_user_id: userId, event: "receipt_emailed",
            meta: { to: invoice.bill_to_email, resend_id: receiptId },
          });
        } else {
          console.error("receipt send failed", r.status, j);
        }
      } catch (e) {
        console.error("receipt fetch error", e);
      }
    }

    return json({ success: true, advanced, receipt_id: receiptId });
  } catch (err) {
    console.error("mark-invoice-paid fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});