// Supabase Edge Function: billing-send-reminders
// Sends payment reminders for unpaid invoices:
//   - "pre_due"  : 7 days before due_at (once)
//   - "due"      : on due_at (once)
//   - "overdue"  : after due_at, every 7 days (cap at 4 reminders)
// Also auto-flips status from "sent" → "overdue" when past due.
//
// Auth: x-cron-secret header (CRON_SECRET) OR super_admin JWT.
//
// Required secrets:
//   CRON_SECRET, RESEND_API_KEY
// Optional: RESEND_FROM, R2_WORKER_BASE_URL, R2_WORKER_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((da - db) / 86400000);
}

async function authorize(req: Request): Promise<true | Response> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader === CRON_SECRET) return true;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const { data: isSuper } = await userClient.rpc("has_role", {
    _user_id: userData.user.id, _role: "super_admin",
  });
  if (!isSuper) return json({ error: "Forbidden" }, 403);
  return true;
}

async function fetchPdfUrl(invoice: any): Promise<string | null> {
  const R2_WORKER_BASE_URL = Deno.env.get("R2_WORKER_BASE_URL");
  const R2_WORKER_SECRET = Deno.env.get("R2_WORKER_SECRET");
  if (!invoice.pdf_r2_key || !R2_WORKER_BASE_URL || !R2_WORKER_SECRET) return null;
  try {
    const r = await fetch(
      `${R2_WORKER_BASE_URL}/invoices/${encodeURIComponent(invoice.id)}/download?key=${encodeURIComponent(invoice.pdf_r2_key)}`,
      { headers: { Authorization: `Bearer ${R2_WORKER_SECRET}` } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.url ?? null;
  } catch { return null; }
}

async function sendReminderEmail(invoice: any, kind: "pre_due" | "due" | "overdue"): Promise<{ ok: boolean; id?: string; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Billing <onboarding@resend.dev>";
  const recipient = invoice.bill_to_email;
  if (!recipient) return { ok: false, error: "no bill_to_email" };

  const number = invoice.invoice_number ?? invoice.id.slice(0, 8);
  const currency = invoice.currency ?? "USD";
  const total = ((invoice.total_cents ?? 0) / 100).toFixed(2);
  const due = invoice.due_at ?? "—";

  const subjects: Record<string, string> = {
    pre_due: `Reminder: Invoice ${number} is due ${due}`,
    due:     `Invoice ${number} is due today`,
    overdue: `Past due: Invoice ${number}`,
  };
  const headlines: Record<string, string> = {
    pre_due: `Your invoice is due in a few days`,
    due:     `Your invoice is due today`,
    overdue: `Your invoice is past due`,
  };
  const pdfUrl = await fetchPdfUrl(invoice);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h2 style="margin:0 0 12px;">${esc(headlines[kind])}</h2>
      <p>Hello ${esc(invoice.bill_to_contact_name ?? invoice.bill_to_legal_name ?? "")},</p>
      <p>This is a reminder that invoice <strong>${esc(number)}</strong> for <strong>${esc(currency)} ${esc(total)}</strong> ${kind === "overdue" ? "is past due" : `is due on ${esc(due)}`}.</p>
      ${pdfUrl ? `<p><a href="${pdfUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Download PDF</a></p>` : `<p>Please log in to your account to view this invoice.</p>`}
      <p style="font-size:12px;color:#888;margin-top:24px;">If you have already paid, please disregard this notice.</p>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_FROM, to: [recipient], subject: subjects[kind], html }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: `resend ${r.status}: ${JSON.stringify(j)}` };
  return { ok: true, id: j?.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ok = await authorize(req);
  if (ok !== true) return ok;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = !!body?.dry_run;

  const today = new Date().toISOString().slice(0, 10);

  // Auto-mark overdue
  if (!dryRun) {
    await admin.from("invoices")
      .update({ status: "overdue" })
      .lt("due_at", today)
      .eq("status", "sent");
  }

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("*")
    .in("status", ["sent", "overdue"])
    .not("due_at", "is", null);
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const inv of invoices ?? []) {
    const due = inv.due_at as string;
    const delta = daysBetween(today, due); // negative = before due
    const reminders = (inv.reminders_sent ?? {}) as Record<string, string>;

    let kind: "pre_due" | "due" | "overdue" | null = null;
    if (delta < 0 && delta >= -7 && !reminders.pre_due) {
      kind = "pre_due";
    } else if (delta === 0 && !reminders.due) {
      kind = "due";
    } else if (delta > 0) {
      const overdueCount = Number(reminders.overdue_count ?? 0);
      const lastOverdue = reminders.overdue_last;
      const daysSinceLast = lastOverdue ? daysBetween(today, lastOverdue) : 999;
      if (overdueCount < 4 && daysSinceLast >= 7) kind = "overdue";
    }

    if (!kind) { results.push({ invoice_id: inv.id, skipped: true }); continue; }

    if (dryRun) {
      results.push({ invoice_id: inv.id, kind, would_send_to: inv.bill_to_email });
      continue;
    }

    const res = await sendReminderEmail(inv, kind);
    if (!res.ok) {
      results.push({ invoice_id: inv.id, kind, error: res.error });
      continue;
    }
    const newReminders: Record<string, any> = { ...reminders };
    if (kind === "overdue") {
      newReminders.overdue_count = Number(reminders.overdue_count ?? 0) + 1;
      newReminders.overdue_last = today;
    } else {
      newReminders[kind] = today;
    }
    await admin.from("invoices").update({ reminders_sent: newReminders }).eq("id", inv.id);
    await admin.from("invoice_events").insert({
      invoice_id: inv.id, actor_user_id: null,
      event: `reminder_${kind}`,
      meta: { to: inv.bill_to_email, resend_id: res.id ?? null },
    });
    results.push({ invoice_id: inv.id, kind, resend_id: res.id });
  }

  return json({ success: true, processed: results.length, results });
});