import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Users, FileText, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STAGE_COLORS: Record<string, string> = {
  applied: "hsl(220, 70%, 52%)",
  shortlisted: "hsl(160, 60%, 42%)",
  screening: "hsl(38, 92%, 50%)",
  scheduling: "hsl(190, 70%, 45%)",
  "1st_interview": "hsl(270, 50%, 52%)",
  "2nd_interview": "hsl(290, 55%, 50%)",
  interview: "hsl(270, 50%, 52%)",
  offer: "hsl(152, 55%, 42%)",
  hired: "hsl(142, 60%, 42%)",
  rejected: "hsl(4, 68%, 48%)",
};

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  screening: "Screening",
  scheduling: "Scheduling",
  "1st_interview": "1st Interview",
  "2nd_interview": "2nd Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [jobs, setJobs] = useState<{ id: string; title: string; status: string }[]>([]);
  const [appRows, setAppRows] = useState<{ stage: string; job_id: string; candidate_id: string }[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [jobFilter, setJobFilter] = useState<string>("all");

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const [jobsRes, candidatesRes, appsRes] = await Promise.all([
        supabase.from("jobs").select("id, title, status").order("created_at", { ascending: false }),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("stage, job_id, candidate_id"),
      ]);
      setJobs((jobsRes.data ?? []) as any);
      setAppRows((appsRes.data ?? []) as any);
      setTotalCandidates(candidatesRes.count ?? 0);
    };
    load();
  }, [profile]);

  if (role === "super_admin") return <Navigate to="/admin" replace />;

  const isAll = jobFilter === "all";
  const filteredApps = isAll ? appRows : appRows.filter((a) => a.job_id === jobFilter);

  // Total applicants = unique candidates that have any application (in selection)
  const uniqueApplicants = new Set(filteredApps.map((a) => a.candidate_id)).size;

  const stageOrder = ["applied", "shortlisted", "screening", "scheduling", "1st_interview", "2nd_interview", "offer", "hired", "rejected"];
  const counts: Record<string, number> = {};
  filteredApps.forEach((a) => {
    counts[a.stage] = (counts[a.stage] || 0) + 1;
  });
  const stageCounts = stageOrder.map((s) => ({ stage: s, count: counts[s] || 0 }));

  const openJobs = jobs.filter((j) => j.status === "open").length;

  const cards = [
    {
      label: isAll ? "Total Applicants" : "Applicants for Job",
      value: uniqueApplicants,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Applications",
      value: filteredApps.length,
      icon: FileText,
      color: "hsl(38,92%,50%)",
    },
    {
      label: "Open Jobs",
      value: isAll ? openJobs : 1,
      icon: Briefcase,
      color: "text-accent",
    },
    {
      label: "All Candidates",
      value: totalCandidates,
      icon: TrendingUp,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {profile?.name}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Filter by job
          </label>
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="All jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                  {j.status !== "open" ? " (closed)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                tickFormatter={(v: string) => STAGE_LABELS[v] ?? v}
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
                labelFormatter={(v: string) => STAGE_LABELS[v] ?? v}
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
