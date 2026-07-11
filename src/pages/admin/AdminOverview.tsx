import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Briefcase, FileText, Trophy, UserCheck } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ScreeningAnalytics from "@/components/screening/ScreeningAnalytics";
import { BentoGrid, BentoTile } from "@/components/dashboard/BentoGrid";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { RangeFilter } from "@/components/dashboard/RangeFilter";
import { RangeKey, rangeBounds, rangeToDays, inRange, deltaPct, bucketByDay } from "@/lib/dashboardMetrics";

interface AppRow { company_id: string; created_at: string; updated_at: string; stage: string; }

export default function AdminOverview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [candidateCount, setCandidateCount] = useState(0);
  const [jobs, setJobs] = useState<{ id: string; status: string; company_id: string }[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [companiesRes, profiles, candidates, jobsRes, appsRes] = await Promise.all([
        supabase.from("companies").select("id, name"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("candidates").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id, status, company_id"),
        supabase.from("applications").select("company_id, created_at, updated_at, stage"),
      ]);
      setCompanies((companiesRes.data ?? []) as any);
      setUserCount(profiles.count ?? 0);
      setCandidateCount(candidates.count ?? 0);
      setJobs((jobsRes.data ?? []) as any);
      setApps((appsRes.data ?? []) as any);
      setLoading(false);
    };
    load();
  }, []);

  const { from, prevFrom, prevTo } = rangeBounds(range);
  const days = rangeToDays(range);

  const appsCurrent = useMemo(() => (from ? inRange(apps, "created_at", from) : apps), [apps, from]);
  const appsPrev = useMemo(() => (prevFrom && prevTo ? inRange(apps, "created_at", prevFrom, prevTo) : []), [apps, prevFrom, prevTo]);

  const hiresCurrent = apps.filter((a) => a.stage === "hired" && (!from || new Date(a.updated_at) >= from)).length;
  const hiresPrev = apps.filter((a) => a.stage === "hired" && prevFrom && prevTo && new Date(a.updated_at) >= prevFrom && new Date(a.updated_at) < prevTo).length;

  const activeCompanyIds = new Set(appsCurrent.map((a) => a.company_id));
  const openJobs = jobs.filter((j) => j.status === "open").length;

  const sparkDays = days ?? 30;
  const trend = bucketByDay(apps, "created_at", sparkDays);
  const appsSpark = bucketByDay(apps, "created_at", sparkDays);

  // Top companies by applications in range
  const companyMap = new Map(companies.map((c) => [c.id, c.name] as const));
  const byCompany: Record<string, number> = {};
  appsCurrent.forEach((a) => { byCompany[a.company_id] = (byCompany[a.company_id] || 0) + 1; });
  const topCompanies = Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, name: companyMap.get(id) ?? "Unknown", count }));
  const topMax = Math.max(1, ...topCompanies.map((c) => c.count));

  return (
    <div className="space-y-8">
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Activity across all companies, users, and jobs.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time range</label>
          <div><RangeFilter value={range} onChange={setRange} /></div>
        </div>
      </div>

      <BentoGrid>
        <BentoTile delay={0}>
          <KpiTile label="Companies" value={companies.length} icon={Building2} loading={loading} />
        </BentoTile>
        <BentoTile delay={60}>
          <KpiTile
            label="Active companies"
            value={activeCompanyIds.size}
            icon={UserCheck}
            iconAccent="bg-emerald-500/10 text-emerald-600"
            loading={loading}
          />
        </BentoTile>
        <BentoTile delay={120}>
          <KpiTile label="Users" value={userCount} icon={Users} iconAccent="bg-accent/10 text-accent" loading={loading} />
        </BentoTile>
        <BentoTile delay={180}>
          <KpiTile label="Open jobs" value={openJobs} icon={Briefcase} iconAccent="bg-amber-500/10 text-amber-600" loading={loading} />
        </BentoTile>

        <BentoTile delay={240}>
          <KpiTile
            label="Applications"
            value={appsCurrent.length}
            delta={range === "all" ? null : deltaPct(appsCurrent.length, appsPrev.length)}
            icon={FileText}
            spark={appsSpark}
            loading={loading}
          />
        </BentoTile>
        <BentoTile delay={300}>
          <KpiTile
            label="Hires"
            value={hiresCurrent}
            delta={range === "all" ? null : deltaPct(hiresCurrent, hiresPrev)}
            icon={Trophy}
            iconAccent="bg-emerald-500/10 text-emerald-600"
            loading={loading}
          />
        </BentoTile>
        <BentoTile colSpan={2} delay={360}>
          <KpiTile label="Total candidates" value={candidateCount} icon={Users} iconAccent="bg-primary/10 text-primary" loading={loading} />
        </BentoTile>

        {/* Applications trend */}
        <BentoTile colSpan={2} rowSpan={2} delay={420}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Applications across platform</h2>
            <span className="text-xs text-muted-foreground">Last {sparkDays} days</span>
          </div>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminAppsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.slice(5)} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#adminAppsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoTile>

        {/* Top companies */}
        <BentoTile colSpan={2} rowSpan={2} delay={480}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Top companies by applications</h2>
            <span className="text-xs text-muted-foreground">in range</span>
          </div>
          <div className="flex-1 space-y-3">
            {topCompanies.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No applications in this range yet.</p>
            )}
            {topCompanies.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[20px_1fr_40px] items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">#{i + 1}</span>
                <div className="space-y-1">
                  <span className="text-sm font-medium truncate block">{c.name}</span>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.count / topMax) * 100}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-right">{c.count}</span>
              </div>
            ))}
          </div>
        </BentoTile>
      </BentoGrid>

      <ScreeningAnalytics />
    </div>
  );
}
