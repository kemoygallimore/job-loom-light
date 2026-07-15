import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_FEATURES,
  blankSubscription,
  type Addon,
  type AdminCompanyDetailData,
  type CompanySummary,
  type Features,
  type PlanDefaults,
  type Subscription,
} from "./types";

type QueryError = { message: string } | null;
type QueryResult = { data: unknown; error: QueryError };
type AdminQuery = PromiseLike<QueryResult> & {
  delete: () => AdminQuery;
  eq: (column: string, value: unknown) => AdminQuery;
  insert: (payload: unknown) => AdminQuery;
  maybeSingle: () => AdminQuery;
  order: (column: string, options?: Record<string, unknown>) => AdminQuery;
  select: (columns?: string) => AdminQuery;
  update: (payload: unknown) => AdminQuery;
  upsert: (payload: unknown, options?: Record<string, unknown>) => AdminQuery;
};
type AdminDb = {
  from: (table: string) => AdminQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<QueryResult>;
};

const adminDb = supabase as unknown as AdminDb;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toCompany(value: unknown): CompanySummary | null {
  if (!isRecord(value)) return null;
  return {
    name: stringValue(value.name),
    status: stringValue(value.status, "active"),
  };
}

function toDefaults(value: unknown): PlanDefaults | null {
  if (!isRecord(value)) return null;
  return {
    annual_price_cents: numberValue(value.annual_price_cents),
    included_open_jobs: numberValue(value.included_open_jobs),
    included_seats: numberValue(value.included_seats),
    currency: stringValue(value.currency, "USD"),
    addon_price_extra_jobs_pack5_cents: numberValue(value.addon_price_extra_jobs_pack5_cents),
    addon_price_extra_seats_pack2_cents: numberValue(value.addon_price_extra_seats_pack2_cents),
    addon_price_email_notifications_cents: numberValue(value.addon_price_email_notifications_cents),
    addon_price_custom_email_domain_cents: numberValue(value.addon_price_custom_email_domain_cents),
  };
}

function toSubscription(value: unknown, companyId: string): Subscription {
  if (!isRecord(value)) return blankSubscription(companyId);
  return {
    id: stringValue(value.id) || undefined,
    company_id: stringValue(value.company_id, companyId),
    override_annual_price_cents: nullableNumber(value.override_annual_price_cents),
    override_open_jobs: nullableNumber(value.override_open_jobs),
    override_seats: nullableNumber(value.override_seats),
    discount_type: nullableString(value.discount_type),
    discount_value: nullableNumber(value.discount_value),
    discount_note: nullableString(value.discount_note),
    subscription_start_date: nullableString(value.subscription_start_date),
    renewal_date: nullableString(value.renewal_date),
    auto_renew: typeof value.auto_renew === "boolean" ? value.auto_renew : null,
  };
}

function toAddon(value: unknown): Addon | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const companyId = stringValue(value.company_id);
  if (!id || !companyId) return null;
  return {
    id,
    company_id: companyId,
    addon_type: stringValue(value.addon_type),
    quantity: numberValue(value.quantity, 1),
    unit_price_cents: numberValue(value.unit_price_cents),
    active: booleanValue(value.active),
    note: nullableString(value.note),
  };
}

function toFeatures(value: unknown): Features {
  if (!isRecord(value)) return DEFAULT_FEATURES;
  return {
    feature_assessment: booleanValue(value.feature_assessment),
    feature_public_careers: booleanValue(value.feature_public_careers, true),
    feature_guest_feedback: booleanValue(value.feature_guest_feedback, true),
    feature_email_notifications: booleanValue(value.feature_email_notifications),
    feature_custom_email_domain: booleanValue(value.feature_custom_email_domain),
  };
}

function resultNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getAdminCompanyDetail(companyId: string): Promise<AdminCompanyDetailData> {
  const [companyRes, defaultsRes, subRes, addonsRes, featuresRes, jobLimitRes, seatLimitRes] = await Promise.all([
    supabase.from("companies").select("name, status").eq("id", companyId).maybeSingle(),
    adminDb.from("plan_defaults").select("*").maybeSingle(),
    adminDb.from("company_subscriptions").select("*").eq("company_id", companyId).maybeSingle(),
    adminDb.from("company_addons").select("*").eq("company_id", companyId).order("created_at"),
    adminDb.from("company_features").select("*").eq("company_id", companyId).maybeSingle(),
    adminDb.rpc("get_company_job_limit", { _company_id: companyId }),
    adminDb.rpc("get_company_seat_limit", { _company_id: companyId }),
  ]);

  return {
    addons: Array.isArray(addonsRes.data) ? addonsRes.data.map(toAddon).filter((addon): addon is Addon => Boolean(addon)) : [],
    company: toCompany(companyRes.data),
    defaults: toDefaults(defaultsRes.data),
    features: toFeatures(featuresRes.data),
    jobLimit: resultNumber(jobLimitRes.data),
    seatLimit: resultNumber(seatLimitRes.data),
    subscription: toSubscription(subRes.data, companyId),
  };
}

export async function updateCompany(companyId: string, name: string, status: string) {
  const { error } = await supabase.from("companies").update({ name, status }).eq("id", companyId);
  if (error) throw error;
}

export async function upsertSubscription(companyId: string, sub: Subscription) {
  const payload = {
    company_id: companyId,
    override_annual_price_cents: sub.override_annual_price_cents,
    override_open_jobs: sub.override_open_jobs,
    override_seats: sub.override_seats,
    discount_type: sub.discount_type,
    discount_value: sub.discount_value,
    discount_note: sub.discount_note,
    subscription_start_date: sub.subscription_start_date,
    renewal_date: sub.renewal_date,
    auto_renew: sub.auto_renew,
  };
  const { error } = await adminDb.from("company_subscriptions").upsert(payload, { onConflict: "company_id" });
  if (error) throw error;

  if (sub.override_open_jobs != null) {
    const legacyRes = await supabase.from("companies").update({ max_open_jobs: sub.override_open_jobs }).eq("id", companyId);
    if (legacyRes.error) throw legacyRes.error;
  }
}

export async function upsertFeatures(companyId: string, features: Features) {
  const { error } = await adminDb.from("company_features").upsert(
    { company_id: companyId, ...features },
    { onConflict: "company_id" },
  );
  if (error) throw error;
}

export async function insertAddon(companyId: string, addonType: string, quantity: number, unitPriceCents: number) {
  const { error } = await adminDb.from("company_addons").insert({
    company_id: companyId,
    addon_type: addonType,
    quantity,
    unit_price_cents: unitPriceCents,
    active: true,
  });
  if (error) throw error;
}

export async function setAddonActive(addonId: string, active: boolean) {
  const { error } = await adminDb.from("company_addons").update({ active }).eq("id", addonId);
  if (error) throw error;
}

export async function removeAddon(addonId: string) {
  const { error } = await adminDb.from("company_addons").delete().eq("id", addonId);
  if (error) throw error;
}
