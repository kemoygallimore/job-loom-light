// Supabase Edge Function: send-invoice-email
// Sends an invoice email to the billing contact via Resend.
//
// Required secrets:
//   RESEND_API_KEY       = Resend API key (raw, not connector gateway)
//   R2_WORKER_BASE_URL   = Cloudflare Worker base URL (for signed PDF link)
//   R2_WORKER_SECRET     = Worker shared secret
// Optional:
//   RESEND_FROM          = "Billing <billing@yourdomain.com>" (defaults to onboarding@resend.dev)
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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

function escape(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
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
    const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
    const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");

    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: isSuper, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userId, _role: "super_admin",
    });
    if (roleErr) return json({ error: "Authorization check failed" }, 500);
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    // --- Input ---
    const body = await req.json().catch(() => null);
    const invoice_id: string | undefined = body?.invoice_id;
    const extraTo: string[] = Array.isArray(body?.cc) ? body.cc : [];
    if (!invoice_id || typeof invoice_id !== "string") {
      return json({ error: "invoice_id is required" }, 400);
    }

    // --- Load invoice ---
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr) return json({ error: "Failed to load invoice" }, 500);
    if (!invoice) return json({ error: "Invoice not found" }, 404);

    const recipient = invoice.bill_to_email;
    if (!recipient) return json({ error: "Invoice has no bill_to_email" }, 400);

    // --- Optional: get signed PDF URL (if PDF exists & worker configured) ---
    let pdfUrl: string | null = null;
    if (invoice.pdf_r2_key && R2_WORKER_BASE_URL && R2_WORKER_SECRET) {
      try {
        const wRes = await fetch(
          `${R2_WORKER_BASE_URL}/invoices/${encodeURIComponent(invoice.id)}/download?key=${encodeURIComponent(invoice.pdf_r2_key)}`,
          { headers: { Authorization: `Bearer ${R2_WORKER_SECRET}` } },
        );
        if (wRes.ok) {
          const j = await wRes.json();
          pdfUrl = j?.url ?? null;
        } else {
          console.warn("Worker download URL failed", wRes.status);
        }
      } catch (e) {
        console.warn("Worker fetch error", e);
      }
    }

    const currency = invoice.currency ?? "USD";
    const total = ((invoice.total_cents ?? 0) / 100).toFixed(2);
    const number = invoice.invoice_number ?? invoice.id.slice(0, 8);

    const subject = `Invoice ${number} — ${currency} ${total}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin:0 0 12px;">Invoice ${escape(number)}</h2>
        <p>Hello ${escape(invoice.bill_to_contact_name ?? invoice.bill_to_legal_name ?? "")},</p>
        <p>Your invoice is now available.</p>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:4px 12px 4px 0;color:#666;">Number</td><td>${escape(number)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;">Period</td><td>${escape(invoice.period_start)} → ${escape(invoice.period_end)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;">Due</td><td>${escape(invoice.due_at ?? "—")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;"><strong>Total</strong></td><td><strong>${escape(currency)} ${escape(total)}</strong></td></tr>
        </table>
        ${pdfUrl ? `<p><a href="${pdfUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Download PDF</a></p><p style="font-size:12px;color:#666;">This download link expires shortly. You can also log in to your account to view this invoice at any time.</p>` : `<p>Please log in to your account to view and download this invoice.</p>`}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:12px;color:#888;">Thank you for your business.</p>
      </div>
    `;

    // --- Send via Resend ---
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [recipient, ...extraTo],
        subject,
        html,
      }),
    });
    const resendJson = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("Resend send failed", resendRes.status, resendJson);
      return json({ error: "Email send failed", details: resendJson }, 502);
    }

    // --- Log event ---
    await admin.from("invoice_events").insert({
      invoice_id,
      actor_user_id: userId,
      event: "emailed",
      meta: { to: recipient, resend_id: resendJson?.id ?? null, has_pdf: !!pdfUrl },
    });

    return json({ success: true, resend_id: resendJson?.id ?? null });
  } catch (err) {
    console.error("send-invoice-email fatal", err);
    return json({ error: "Internal server error" }, 500);
  }
});
