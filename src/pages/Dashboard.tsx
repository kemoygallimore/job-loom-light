import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, FileText, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, applications: 0, openJobs: 0 });

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const [jobs, candidates, applications] = await Promise.all([
        supabase.from("jobs").select("id, status"),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id", { count: "exact", head: true }),
      ]);
      const jobList = jobs.data ?? [];
      setStats({
        jobs: jobList.length,
        candidates: candidates.count ?? 0,
        applications: applications.count ?? 0,
        openJobs: jobList.filter(j => j.status === "open").length,
      });
    };
    load();
  }, [profile]);

  if (role === "super_admin") return <Navigate to="/admin" replace />;

  const cards = [
    { label: "Open Jobs", value: stats.openJobs, icon: Briefcase, color: "text-primary" },
    { label: "Total Candidates", value: stats.candidates, icon: Users, color: "text-accent" },
    { label: "Applications", value: stats.applications, icon: FileText, color: "text-warning" },
    { label: "Total Jobs", value: stats.jobs, icon: TrendingUp, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {profile?.name}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <Card key={c.label} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
