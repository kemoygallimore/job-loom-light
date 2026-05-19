import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import CompanyUsersTab from "@/components/admin/CompanyUsersTab";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage who has access to your workspace. Seat limits come from your subscription plan and add-ons.
        </p>
      </div>
      <CompanyUsersTab companyId={profile.company_id} seatLimit={seatLimit} />
    </div>
  );
}