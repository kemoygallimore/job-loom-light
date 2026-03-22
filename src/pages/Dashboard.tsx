import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Users, FileText, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STAGE_COLORS: Record<string, string> = {
  applied: "hsl(220, 70%, 52%)",
  screening: "hsl(38, 92%, 50%)",
  interview: "hsl(270, 50%, 52%)",
  offer: "hsl(152, 55%, 42%)",
  hired: "hsl(142, 60%, 42%)",
  rejected: "hsl(4, 68%, 48%)",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, applications: 0, openJobs: 0 });
  const [stageCounts, setStageCounts] = useState<{ stage: string; count: number }[]>([]);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const [jobs, candidates, applications, appRows] = await Promise.all([
        supabase.from("jobs").select("id, status"),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("stage"),
      ]);
      const jobList = jobs.data ?? [];
      setStats({
        jobs: jobList.length,
        candidates: candidates.count ?? 0,
        applications: applications.count ?? 0,
        openJobs: jobList.filter(j => j.status === "open").length,
      });

      // Count by stage
      const counts: Record<string, number> = {};
      (appRows.data ?? []).forEach((a: any) => {
        counts[a.stage] = (counts[a.stage] || 0) + 1;
      });
      const stageOrder = ["applied", "screening", "interview", "offer", "hired", "rejected"];
      setStageCounts(stageOrder.map(s => ({ stage: s, count: counts[s] || 0 })));
    };
    load();
  }, [profile]);

  if (role === "super_admin") return <Navigate to="/admin" replace />;

  const cards = [
    { label: "Open Jobs", value: stats.openJobs, icon: Briefcase, color: "text-primary" },
    { label: "Candidates", value: stats.candidates, icon: Users, color: "text-accent" },
    { label: "Applications", value: stats.applications, icon: FileText, color: "hsl(38,92%,50%)" },
    { label: "Total Jobs", value: stats.jobs, icon: TrendingUp, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Welcome back, {profile?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <c.icon className={`w-4 h-4 ${typeof c.color === "string" && c.color.startsWith("text-") ? c.color : ""}`} style={typeof c.color === "string" && !c.color.startsWith("text-") ? { color: c.color } : undefined} />
            </div>
            <div className="text-3xl font-bold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline chart */}
      <div className="stat-card animate-fade-in" style={{ animationDelay: "320ms" }}>
        <h2 className="text-sm font-semibold mb-4">Candidates by Stage</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageCounts} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="stage"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.1)",
                }}
                labelFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {stageCounts.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
