export type RangeKey = "7d" | "30d" | "90d" | "all";

export function rangeToDays(r: RangeKey): number | null {
  if (r === "all") return null;
  return parseInt(r, 10);
}

export function rangeBounds(r: RangeKey, now = new Date()) {
  const days = rangeToDays(r);
  if (days == null) return { from: null as Date | null, prevFrom: null as Date | null, prevTo: null as Date | null };
  const from = new Date(now.getTime() - days * 86400000);
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - days * 86400000);
  return { from, prevFrom, prevTo };
}

export function inRange<T extends Record<string, any>>(rows: T[], field: keyof T, from: Date | null, to: Date | null = null) {
  return rows.filter((r) => {
    const v = r[field];
    if (!v) return false;
    const d = new Date(v as string);
    if (from && d < from) return false;
    if (to && d >= to) return false;
    return true;
  });
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function bucketByDay<T extends Record<string, any>>(rows: T[], field: keyof T, days: number, now = new Date()) {
  const buckets: { date: string; count: number }[] = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 86400000);
    buckets.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.date, i] as const));
  rows.forEach((r) => {
    const v = r[field];
    if (!v) return;
    const key = new Date(v as string).toISOString().slice(0, 10);
    const i = idx.get(key);
    if (i != null) buckets[i].count += 1;
  });
  return buckets;
}

export function avgDaysBetween<T extends Record<string, any>>(rows: T[], from: keyof T, to: keyof T): number | null {
  const diffs = rows
    .map((r) => {
      const a = r[from]; const b = r[to];
      if (!a || !b) return null;
      return (new Date(b as string).getTime() - new Date(a as string).getTime()) / 86400000;
    })
    .filter((n): n is number => n != null && isFinite(n) && n >= 0);
  if (diffs.length === 0) return null;
  return diffs.reduce((s, n) => s + n, 0) / diffs.length;
}

export function staleApplications<T extends { stage: string; updated_at: string }>(rows: T[], days = 14, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  return rows.filter((r) => r.stage !== "hired" && r.stage !== "rejected" && new Date(r.updated_at) < cutoff);
}