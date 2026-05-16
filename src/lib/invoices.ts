import { supabase } from "@/integrations/supabase/client";
import { assertBillingProfileReady } from "./billingProfile";

const ADDON_DESCRIPTIONS: Record<string, string> = {
  extra_jobs_pack5: "Extra Open Jobs (pack of 5)",
  extra_seats_pack2: "Extra User Seats (pack of 2)",
  email_notifications: "Candidate Email Notifications",
  custom_email_domain: "Custom Email Domain",
};

interface LineItemInput {
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  source: "plan" | "addon" | "discount" | "manual";
}

/**
 * Generates a draft invoice for the next billing cycle of `companyId`.
 * Snapshots the billing profile into `bill_to_*` fields and inserts line
 * items derived from plan_defaults + company_subscriptions + company_addons.
 * Returns the new invoice id.
 */
export async function generateInvoiceForNextCycle(companyId: string, actorUserId: string | null): Promise<string> {
  const profile = await assertBillingProfileReady(companyId);

  const [defaultsRes, subRes, addonsRes] = await Promise.all([
    (supabase as any).from("plan_defaults").select("*").maybeSingle(),
    (supabase as any).from("company_subscriptions").select("*").eq("company_id", companyId).maybeSingle(),
    (supabase as any).from("company_addons").select("*").eq("company_id", companyId).eq("active", true),
  ]);
  if (defaultsRes.error) throw defaultsRes.error;
  if (subRes.error) throw subRes.error;
  if (addonsRes.error) throw addonsRes.error;

  const defaults = defaultsRes.data;
  const sub = subRes.data;
  const addons = (addonsRes.data ?? []) as any[];
  if (!defaults) throw new Error("plan_defaults missing");
  if (!sub?.renewal_date) throw new Error("Renewal date is not set for this company (run Stage B).");

  const currency = defaults.currency ?? "USD";
  const planPrice = sub.override_annual_price_cents ?? defaults.annual_price_cents ?? 0;

  const lines: LineItemInput[] = [];

  lines.push({
    description: "Annual Subscription",
    quantity: 1,
    unit_price_cents: planPrice,
    amount_cents: planPrice,
    source: "plan",
  });

  for (const a of addons) {
    const desc = ADDON_DESCRIPTIONS[a.addon_type] ?? a.addon_type;
    const amount = (a.unit_price_cents ?? 0) * (a.quantity ?? 1);
    lines.push({
      description: desc,
      quantity: a.quantity ?? 1,
      unit_price_cents: a.unit_price_cents ?? 0,
      amount_cents: amount,
      source: "addon",
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount_cents, 0);

  // Discount
  let discount = 0;
  if (sub.discount_type === "percent" && sub.discount_value) {
    discount = Math.round(subtotal * (Number(sub.discount_value) / 100));
  } else if (sub.discount_type === "fixed" && sub.discount_value) {
    discount = Math.round(Number(sub.discount_value) * 100);
  }
  if (discount > 0) {
    lines.push({
      description: sub.discount_note ? `Discount — ${sub.discount_note}` : "Discount",
      quantity: 1,
      unit_price_cents: -discount,
      amount_cents: -discount,
      source: "discount",
    });
  }

  const total = subtotal - discount;

  // Period: from renewal_date to renewal_date + 1 year (next cycle)
  const periodStart: string = sub.renewal_date;
  const startDate = new Date(periodStart + "T00:00:00Z");
  const endDate = new Date(startDate);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
  const periodEnd = endDate.toISOString().slice(0, 10);

  const { data: invoice, error: insErr } = await (supabase as any)
    .from("invoices")
    .insert({
      company_id: companyId,
      status: "draft",
      currency,
      subtotal_cents: subtotal,
      discount_cents: discount,
      total_cents: total,
      period_start: periodStart,
      period_end: periodEnd,
      due_at: periodStart,
      issued_at: null,
      bill_to_legal_name: profile.legal_name,
      bill_to_email: profile.billing_email,
      bill_to_contact_name: profile.billing_contact_name,
      bill_to_phone: profile.billing_phone,
      bill_to_address: profile.billing_address,
      bill_to_trn: profile.trn,
      bill_to_customer_code: profile.customer_code,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  const invoiceId = invoice.id as string;

  if (lines.length > 0) {
    const { error: liErr } = await (supabase as any)
      .from("invoice_line_items")
      .insert(lines.map((l) => ({ ...l, invoice_id: invoiceId })));
    if (liErr) throw liErr;
  }

  await logInvoiceEvent(invoiceId, "draft_created", { actor_user_id: actorUserId });

  return invoiceId;
}

export async function logInvoiceEvent(
  invoiceId: string,
  event: string,
  meta: Record<string, any> = {}
) {
  const { actor_user_id, ...rest } = meta;
  const { error } = await (supabase as any).from("invoice_events").insert({
    invoice_id: invoiceId,
    actor_user_id: actor_user_id ?? null,
    event,
    meta: rest,
  });
  if (error) console.warn("invoice_events insert failed", error);
}

export interface InvoiceEvent {
  id: string;
  invoice_id: string;
  actor_user_id: string | null;
  event: string;
  meta: Record<string, any>;
  at: string;
}

export async function fetchInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]> {
  const { data, error } = await (supabase as any)
    .from("invoice_events")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvoiceEvent[];
}
