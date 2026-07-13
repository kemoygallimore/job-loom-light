import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FeatureFlags {
  assessment: boolean;
  public_careers: boolean;
  guest_feedback: boolean;
  email_notifications: boolean;
  custom_email_domain: boolean;
}

const DEFAULTS: FeatureFlags = {
  assessment: false,
  public_careers: true,
  guest_feedback: true,
  email_notifications: false,
  custom_email_domain: false,
};

/**
 * Loads feature flags for the authenticated user's company.
 * Super admins (no company_id) get all-true so admin tooling never gets gated.
 */
export function useFeatureFlags() {
  const { profile, role } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const companyId = profile?.company_id;

    if (role === "super_admin") {
      setFlags({
        assessment: true,
        public_careers: true,
        guest_feedback: true,
        email_notifications: true,
        custom_email_domain: true,
      });
      setLoading(false);
      return;
    }
    if (!companyId) {
      setLoading(false);
      return;
    }

    (async () => {
      // TODO: Regenerate Supabase types so company_features is available without this cast.
      const { data } = await (supabase as any)
        .from("company_features")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setFlags({
          assessment: !!data.feature_assessment,
          public_careers: !!data.feature_public_careers,
          guest_feedback: !!data.feature_guest_feedback,
          email_notifications: !!data.feature_email_notifications,
          custom_email_domain: !!data.feature_custom_email_domain,
        });
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.company_id, role]);

  return { flags, loading };
}
