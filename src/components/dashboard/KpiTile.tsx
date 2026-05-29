import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDown, ArrowUp, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiTileProps {
  label: string;
  value: number | string;
  delta?: number | null;
  icon?: LucideIcon;
  iconAccent?: string;
  spark?: { date: string; count: number }[];
  suffix?: string;
  loading?: boolean;
}

export function KpiTile({ label, value, delta, icon: Icon, iconAccent, spark, suffix, loading }: KpiTileProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconAccent ?? "bg-primary/10 text-primary")}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 flex-1">
        <div>
          <div className="text-3xl font-bold tabular-nums leading-none">
            {loading ? <span className="inline-block w-16 h-8 bg-muted animate-pulse rounded" /> : value}
            {suffix && !loading && <span className="text-base text-muted-foreground font-medium ml-1">{suffix}</span>}
          </div>
          {delta != null && !loading && <DeltaBadge delta={delta} />}
        </div>
        {spark && spark.length > 0 && (
          <div className="w-24 h-10 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#spark-${label})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const rounded = Math.round(delta * 10) / 10;
  const isZero = Math.abs(rounded) < 0.1;
  const isUp = rounded > 0;
  const Icon = isZero ? Minus : isUp ? ArrowUp : ArrowDown;
  const color = isZero
    ? "text-muted-foreground bg-muted"
    : isUp
    ? "text-emerald-700 bg-emerald-500/10"
    : "text-destructive bg-destructive/10";
  return (
    <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded", color)}>
      <Icon className="w-3 h-3" />
      {Math.abs(rounded)}%
    </div>
  );
}