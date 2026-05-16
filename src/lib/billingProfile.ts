import { supabase } from "@/integrations/supabase/client";

export interface BillingProfile {
  company_id: string;
  legal_name: string | null;
  billing_email: string;
  billing_contact_name: string | null;
  billing_phone: string | null;
  billing_address: string | null;
  trn: string | null;
  customer_code: string | null;
  created_at?: string;
  updated_at?: string;
}

export const REQUIRED_BILLING_FIELDS: Array<keyof BillingProfile> = [
  "legal_name",
  "billing_email",
  "billing_address",
];

export function missingBillingFields(p: Partial<BillingProfile> | null | undefined): string[] {
  if (!p) return [...REQUIRED_BILLING_FIELDS];
  return REQUIRED_BILLING_FIELDS.filter((k) => {
    const v = (p as any)[k];
    return v == null || String(v).trim() === "";
  });
}

export async function fetchBillingProfile(companyId: string): Promise<BillingProfile | null> {
  const { data, error } = await (supabase as any)
    .from("company_billing_profiles")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as BillingProfile) ?? null;
}

export async function upsertBillingProfile(p: Partial<BillingProfile> & { company_id: string }) {
  const { error } = await (supabase as any)
    .from("company_billing_profiles")
    .upsert(p, { onConflict: "company_id" });
  if (error) throw error;
}

/** Throws with a readable message if required fields are missing. */
export async function assertBillingProfileReady(companyId: string): Promise<BillingProfile> {
  const p = await fetchBillingProfile(companyId);
  const missing = missingBillingFields(p);
  if (missing.length > 0) {
    throw new Error(
      `Billing profile is incomplete. Missing: ${missing.join(", ")}.`
    );
  }
  return p as BillingProfile;
}