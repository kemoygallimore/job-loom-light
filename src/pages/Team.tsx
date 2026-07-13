import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import CompanyUsersTab from "@/components/admin/CompanyUsersTab";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/shared/PageHeader";

export default function Team() {
  const { profile, role } = useAuth();
  const [seatLimit, setSeatLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_company_seat_limit", { _company_id: profile.company_id });
      setSeatLimit(typeof data === "number" ? data : null);
    })();
  }, [profile?.company_id]);

  if (role !== "admin" && role !== "super_admin") return <Navigate to="/dashboard" replace />;
  if (!profile?.company_id) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage who has access to your workspace. Seat limits come from your subscription plan and add-ons."
      />
      <CompanyUsersTab companyId={profile.company_id} seatLimit={seatLimit} />
    </div>
  );
}
