import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Users, FileText, Trophy, Clock, CalendarCheck } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BentoGrid, BentoTile } from "@/components/dashboard/BentoGrid";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { RangeFilter } from "@/components/dashboard/RangeFilter";
import {
  RangeKey,
  rangeBounds,
  rangeToDays,
  inRange,
  deltaPct,
  bucketByDay,
  avgDaysBetween,
  timeToFill,
} from "@/lib/dashboardMetrics";

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

const STAGE_ORDER = [
  "applied",
  "shortlisted",
  "screening",
  "scheduling",
  "1st_interview",
  "2nd_interview",
  "offer",
  "hired",
  "rejected",
];

interface AppRow {
  stage: string;
  job_id: string;
  candidate_id: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [jobs, setJobs] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [appRows, setAppRows] = useState<AppRow[]>([]);
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      setLoading(true);
      const [jobsRes, appsRes] = await Promise.all([
        supabase.from("jobs").select("id, title, status, created_at").order("created_at", { ascending: false }),
        supabase.from("applications").select("stage, job_id, candidate_id, created_at, updated_at"),
      ]);
      setJobs((jobsRes.data ?? []) as any);
      setAppRows((appsRes.data ?? []) as any);
      setLoading(false);
    };
    load();
  }, [profile]);

  const scopedAll = useMemo(
    () => (jobFilter === "all" ? appRows : appRows.filter((a) => a.job_id === jobFilter)),
    [appRows, jobFilter],
  );

  const { from, prevFrom, prevTo } = rangeBounds(range);
  const days = rangeToDays(range);

  const inCurrent = useMemo(() => (from ? inRange(scopedAll, "created_at", from) : scopedAll), [scopedAll, from]);
  const inPrevious = useMemo(
    () => (prevFrom && prevTo ? inRange(scopedAll, "created_at", prevFrom, prevTo) : []),
    [scopedAll, prevFrom, prevTo],
  );

  const applicantsCurrent = new Set(inCurrent.map((a) => a.candidate_id)).size;
  const applicantsPrev = new Set(inPrevious.map((a) => a.candidate_id)).size;

  const hiresCurrent = scopedAll.filter((a) => a.stage === "hired" && (!from || new Date(a.updated_at) >= from)).length;
  const hiresPrev = scopedAll.filter(
    (a) =>
      a.stage === "hired" &&
      prevFrom &&
      prevTo &&
      new Date(a.updated_at) >= prevFrom &&
      new Date(a.updated_at) < prevTo,
  ).length;

  const openJobs = jobs.filter((j) => j.status === "open").length;

  const avgTTH = avgDaysBetween(
    scopedAll.filter((a) => a.stage === "hired" && (!from || new Date(a.updated_at) >= from)),
    "created_at",
    "updated_at",
  );

  const scopedJobs = useMemo(
    () => (jobFilter === "all" ? jobs : jobs.filter((j) => j.id === jobFilter)),
    [jobs, jobFilter],
  );
  const tftCurrent = useMemo(
    () => timeToFill(scopedAll, scopedJobs, from, null),
    [scopedAll, scopedJobs, from],
  );
  const tftPrev = useMemo(
    () => timeToFill(scopedAll, scopedJobs, prevFrom, prevTo),
    [scopedAll, scopedJobs, prevFrom, prevTo],
  );

  const sparkDays = days ?? 30;
  const applicantsSpark = bucketByDay(scopedAll, "created_at", sparkDays);
  const trendData = bucketByDay(scopedAll, "created_at", sparkDays);

  const stageCounts = STAGE_ORDER.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s],
    count: scopedAll.filter((a) => a.stage === s).length,
    color: STAGE_COLORS[s],
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));

  if (role === "super_admin") return <Navigate to="/admin" replace />;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {profile?.name}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time range</label>
            <div>
              <RangeFilter value={range} onChange={setRange} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filter by job</label>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[240px]">
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
      </div>

      {/* Bento grid */}
      <BentoGrid>
        <BentoTile delay={0}>
          <KpiTile
            label="Applicants"
            value={applicantsCurrent}
            delta={range === "all" ? null : deltaPct(applicantsCurrent, applicantsPrev)}
            icon={Users}
            spark={applicantsSpark}
            loading={loading}
          />
        </BentoTile>

        <BentoTile delay={60}>
          <KpiTile
            label="Applications"
            value={inCurrent.length}
            delta={range === "all" ? null : deltaPct(inCurrent.length, inPrevious.length)}
            icon={FileText}
            iconAccent="bg-amber-500/10 text-amber-600"
            loading={loading}
          />
        </BentoTile>

        <BentoTile delay={120}>
          <KpiTile
            label="Open jobs"
            value={openJobs}
            icon={Briefcase}
            iconAccent="bg-accent/10 text-accent"
            loading={loading}
          />
        </BentoTile>

        <BentoTile delay={180}>
          <KpiTile
            label="Hires"
            value={hiresCurrent}
            delta={range === "all" ? null : deltaPct(hiresCurrent, hiresPrev)}
            icon={Trophy}
            iconAccent="bg-emerald-500/10 text-emerald-600"
            loading={loading}
          />
        </BentoTile>

        {/* Pipeline funnel */}
        <BentoTile colSpan={2} rowSpan={2} delay={240}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Pipeline funnel</h2>
            <span className="text-xs text-muted-foreground">{scopedAll.length} total</span>
          </div>
          <div className="space-y-2 flex-1">
            {stageCounts.map((s) => (
              <div key={s.stage} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
                <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                <div className="h-6 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </BentoTile>

        <BentoTile colSpan={2} delay={300}>
          <KpiTile
            label="Avg time to hire"
            value={avgTTH != null ? avgTTH.toFixed(1) : "—"}
            suffix={avgTTH != null ? "days" : undefined}
            icon={Clock}
            iconAccent="bg-primary/10 text-primary"
            loading={loading}
          />
        </BentoTile>

        <BentoTile colSpan={2} delay={330}>
          <KpiTile
            label="Time to fill"
            value={tftCurrent != null ? tftCurrent.toFixed(1) : "—"}
            suffix={tftCurrent != null ? "days" : undefined}
            delta={
              range === "all" || tftCurrent == null || tftPrev == null
                ? null
                : deltaPct(tftCurrent, tftPrev)
            }
            icon={CalendarCheck}
            iconAccent="bg-cyan-500/10 text-cyan-600"
            loading={loading}
          />
        </BentoTile>

        {/* Applications trend */}
        <BentoTile colSpan={2} rowSpan={2} delay={360}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Applications over time</h2>
            <span className="text-xs text-muted-foreground">Last {sparkDays} days</span>
          </div>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="appsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => v.slice(5)}
                  minTickGap={20}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#appsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
