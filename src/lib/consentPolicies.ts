import { supabase } from "@/integrations/supabase/client";

export const DATA_PROTECTION_CONSENT_TEXT =
  "I have read and agree to the policies above and consent to my information being collected, stored, and processed for recruitment purposes.";

export const VIDEO_RECORDING_CONSENT_TEXT =
  "I consent to my video/audio being recorded, stored, and reviewed by the hiring team for recruitment purposes.";

export const GUEST_FEEDBACK_CONSENT_TEXT =
  "I have read and agree to the policies above and consent to my feedback and contact details being collected, stored, and processed for recruitment purposes.";

export interface ConsentPolicyContext {
  company_id: string;
  company_name: string | null;
  company_slug: string | null;
  platform_policy_key: string | null;
  platform_policy_title: string | null;
  platform_policy_version_id: string | null;
  platform_policy_updated_at: string | null;
  company_policy_key: string | null;
  company_policy_title: string | null;
  company_policy_version_id: string | null;
  company_policy_published_at: string | null;
}

export interface ConsentPayloadItem {
  accepted: boolean;
  consent_text: string;
  page_path: string;
}

export type ConsentPayload = Record<string, ConsentPayloadItem>;

export function buildConsentPayload(key: string, accepted: boolean, consentText: string): ConsentPayload {
  return {
    [key]: {
      accepted,
      consent_text: consentText,
      page_path: typeof window === "undefined" ? "" : window.location.pathname,
    },
  };
}

export function mergeConsentPayload(...items: ConsentPayload[]): ConsentPayload {
  return Object.assign({}, ...items);
}

export async function loadConsentPolicyContext(companyId: string): Promise<ConsentPolicyContext | null> {
  const { data, error } = await (supabase as any).rpc("get_public_consent_policy_context", {
    _company_id: companyId,
    _policy_key: "candidate_privacy_notice",
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export function formatPolicyDate(value: string | null | undefined) {
  if (!value) return "Not published";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function companyPolicyUrl(context: ConsentPolicyContext | null) {
  return context?.company_slug && context.company_policy_version_id
    ? `/${context.company_slug}/legal/candidate-privacy`
    : null;
}
