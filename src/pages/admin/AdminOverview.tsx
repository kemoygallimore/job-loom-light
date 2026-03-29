import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Briefcase } from "lucide-react";
import ScreeningAnalytics from "@/pages/screening/ScreeningAnalytics";

export default function AdminOverview() {
  const [stats, setStats] = useState({ companies: 0, users: 0, jobs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [companies, profiles, jobs] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        companies: companies.count ?? 0,
        users: profiles.count ?? 0,
        jobs: jobs.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Companies", value: stats.companies, icon: Building2, accent: "bg-primary/10 text-primary" },
    { label: "Users", value: stats.users, icon: Users, accent: "bg-emerald-500/10 text-emerald-600" },
    { label: "Jobs", value: stats.jobs, icon: Briefcase, accent: "bg-amber-500/10 text-amber-600" },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage all companies, users, and jobs across the platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.accent}`}>
                <c.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {loading ? <span className="inline-block w-12 h-8 bg-muted animate-pulse rounded" /> : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Video Screening Analytics */}
      <ScreeningAnalytics />
    </div>
  );
}
