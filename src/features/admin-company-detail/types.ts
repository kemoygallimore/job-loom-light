export interface CompanySummary {
  name: string;
  status: string;
}

export interface Subscription {
  id?: string;
  company_id: string;
  override_annual_price_cents: number | null;
  override_open_jobs: number | null;
  override_seats: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_note: string | null;
}

export interface Addon {
  id: string;
  company_id: string;
  addon_type: string;
  quantity: number;
  unit_price_cents: number;
  active: boolean;
  note: string | null;
}

export interface PlanDefaults {
  annual_price_cents: number;
  included_open_jobs: number;
  included_seats: number;
  currency: string;
  addon_price_extra_jobs_pack5_cents: number;
  addon_price_extra_seats_pack2_cents: number;
  addon_price_email_notifications_cents: number;
  addon_price_custom_email_domain_cents: number;
}

export interface Features {
  feature_assessment: boolean;
  feature_public_careers: boolean;
  feature_guest_feedback: boolean;
  feature_email_notifications: boolean;
  feature_custom_email_domain: boolean;
}

export interface AdminCompanyDetailData {
  addons: Addon[];
  company: CompanySummary | null;
  defaults: PlanDefaults | null;
  features: Features;
  jobLimit: number | null;
  seatLimit: number | null;
  subscription: Subscription;
}

export const FEATURE_LABELS: Array<{ key: keyof Features; label: string; comingSoon?: boolean }> = [
  { key: "feature_assessment", label: "Assessment Module" },
  { key: "feature_public_careers", label: "Public Careers Portal" },
  { key: "feature_guest_feedback", label: "Guest Feedback Links" },
  { key: "feature_email_notifications", label: "Candidate Email Notifications", comingSoon: true },
  { key: "feature_custom_email_domain", label: "Custom Email Domain", comingSoon: true },
];

export const ADDON_LABELS: Record<string, string> = {
  extra_jobs_pack5: "Extra Open Jobs (pack of 5)",
  extra_seats_pack2: "Extra User Seats (pack of 2)",
  email_notifications: "Candidate Email Notifications",
  custom_email_domain: "Custom Email Domain",
};

export const DEFAULT_FEATURES: Features = {
  feature_assessment: false,
  feature_public_careers: true,
  feature_guest_feedback: true,
  feature_email_notifications: false,
  feature_custom_email_domain: false,
};

export function blankSubscription(companyId: string): Subscription {
  return {
    company_id: companyId,
    override_annual_price_cents: null,
    override_open_jobs: null,
    override_seats: null,
    discount_type: null,
    discount_value: null,
    discount_note: null,
  };
}

export const cents = (n: number | null | undefined) =>
  n == null ? "" : (n / 100).toFixed(2);

export const toCents = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
};
