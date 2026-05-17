// Supabase Edge Function: billing-auto-renewal
// Generates draft invoices for subscriptions whose renewal_date falls
// within the next N days (default 30). Optionally issues the invoice
// and emails the customer.
//
// Auth: x-cron-secret header (CRON_SECRET) OR super_admin JWT.
//
// Required secrets:
//   CRON_SECRET                  = shared secret for cron caller
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADDON_DESCRIPTIONS: Record<string, string> = {
  extra_jobs_pack5: "Extra Open Jobs (pack of 5)",
  extra_seats_pack2: "Extra User Seats (pack of 2)",
  email_notifications: "Candidate Email Notifications",
  custom_email_domain: "Custom Email Domain",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addYearISO(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) return { ok: true };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  const { data: isSuper } = await userClient.rpc("has_role", {
    _user_id: userData.user.id, _role: "super_admin",
  });
  if (!isSuper) return { ok: false, res: json({ error: "Forbidden" }, 403) };
  return { ok: true };
}

async function generateDraft(admin: any, companyId: string, renewalDate: string): Promise<string | null> {
  // Skip if a draft/sent invoice already exists for this period_start
  const { data: existing } = await admin
    .from("invoices").select("id")
    .eq("company_id", companyId).eq("period_start", renewalDate).maybeSingle();
  if (existing) return null;

  const [profileRes, defaultsRes, subRes, addonsRes] = await Promise.all([
    admin.from("company_billing_profiles").select("*").eq("company_id", companyId).maybeSingle(),
    admin.from("plan_defaults").select("*").maybeSingle(),
    admin.from("company_subscriptions").select("*").eq("company_id", companyId).maybeSingle(),
    admin.from("company_addons").select("*").eq("company_id", companyId).eq("active", true),
  ]);
  const profile = profileRes.data;
  const defaults = defaultsRes.data;
  const sub = subRes.data;
  const addons = (addonsRes.data ?? []) as any[];
  if (!profile?.legal_name || !profile?.billing_email) {
    console.warn(`Skipping ${companyId}: billing profile incomplete`);
    return null;
  }
  if (!defaults || !sub) return null;

  const currency = defaults.currency ?? "USD";
  const planPrice = sub.override_annual_price_cents ?? defaults.annual_price_cents ?? 0;

  const lines: any[] = [{
    description: "Annual Subscription",
    quantity: 1, unit_price_cents: planPrice, amount_cents: planPrice, source: "plan",
  }];
  for (const a of addons) {
    const amount = (a.unit_price_cents ?? 0) * (a.quantity ?? 1);
    lines.push({
      description: ADDON_DESCRIPTIONS[a.addon_type] ?? a.addon_type,
      quantity: a.quantity ?? 1, unit_price_cents: a.unit_price_cents ?? 0,
      amount_cents: amount, source: "addon",
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.amount_cents, 0);
  let discount = 0;
  if (sub.discount_type === "percent" && sub.discount_value) {
    discount = Math.round(subtotal * (Number(sub.discount_value) / 100));
  } else if (sub.discount_type === "fixed" && sub.discount_value) {
    discount = Math.round(Number(sub.discount_value) * 100);
  }
  if (discount > 0) {
    lines.push({
      description: sub.discount_note ? `Discount — ${sub.discount_note}` : "Discount",
      quantity: 1, unit_price_cents: -discount, amount_cents: -discount, source: "discount",
    });
  }
  const total = subtotal - discount;

  const periodEnd = addYearISO(renewalDate);

  const { data: invoice, error: insErr } = await admin.from("invoices").insert({
    company_id: companyId, status: "draft", currency,
    subtotal_cents: subtotal, discount_cents: discount, total_cents: total,
    period_start: renewalDate, period_end: periodEnd, due_at: renewalDate, issued_at: null,
    bill_to_legal_name: profile.legal_name,
    bill_to_email: profile.billing_email,
    bill_to_contact_name: profile.billing_contact_name,
    bill_to_phone: profile.billing_phone,
    bill_to_address: profile.billing_address,
    bill_to_trn: profile.trn,
    bill_to_customer_code: profile.customer_code,
  }).select("id").single();
  if (insErr) { console.error("insert invoice failed", insErr); return null; }
  const invoiceId = invoice.id as string;

  await admin.from("invoice_line_items").insert(
    lines.map((l) => ({ ...l, invoice_id: invoiceId }))
  );
  await admin.from("invoice_events").insert({
    invoice_id: invoiceId, actor_user_id: null,
    event: "draft_created", meta: { source: "auto_renewal" },
  });
  return invoiceId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) return auth.res;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.json().catch(() => ({}));
  const windowDays: number = Math.max(1, Math.min(120, Number(body?.window_days ?? 30)));
  const autoIssue: boolean = !!body?.auto_issue;
  const autoEmail: boolean = !!body?.auto_email;
  const dryRun: boolean = !!body?.dry_run;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: subs, error } = await admin
    .from("company_subscriptions")
    .select("company_id, renewal_date, auto_renew")
    .eq("auto_renew", true)
    .gte("renewal_date", today)
    .lte("renewal_date", cutoffStr);
  if (error) return json({ error: error.message }, 500);

  if (dryRun) {
    return json({
      success: true, dry_run: true, window_days: windowDays,
      would_process: subs ?? [],
    });
  }

  const results: any[] = [];
  for (const s of subs ?? []) {
    try {
      const id = await generateDraft(admin, s.company_id, s.renewal_date);
      if (!id) { results.push({ company_id: s.company_id, skipped: true }); continue; }

      if (autoIssue) {
        await admin.from("invoices").update({
          status: "sent", issued_at: new Date().toISOString(),
        }).eq("id", id);
        await admin.from("invoice_events").insert({
          invoice_id: id, actor_user_id: null, event: "issued", meta: { source: "auto_renewal" },
        });
      }
      if (autoIssue && autoEmail) {
        // Fire-and-forget invocation of send-invoice-email via service role
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "x-cron-secret": Deno.env.get("CRON_SECRET") ?? "",
            },
            body: JSON.stringify({ invoice_id: id, _internal: true }),
          });
        } catch (e) {
          console.warn("auto-email invoke failed", e);
        }
      }
      results.push({ company_id: s.company_id, invoice_id: id, issued: autoIssue, emailed: autoIssue && autoEmail });
    } catch (e: any) {
      console.error("auto-renewal error", s.company_id, e);
      results.push({ company_id: s.company_id, error: e.message });
    }
  }

  return json({ success: true, window_days: windowDays, processed: results.length, results });
});