# Bento-style dashboards with pipeline & velocity insights

Redesign both `/dashboard` (tenant) and `/admin` (platform) into a richer, more informative landing screen. Same visual language so they feel like one product.

## Shared look & feel

- Bento grid: asymmetric tiles (1×1, 2×1, 2×2) on `lg`, collapsing to single column on mobile.
- Keep existing teal/cyan tokens, DM Sans, `stat-card` styling — extend, don't replace.
- Sticky top toolbar: greeting + time-range selector (`7d / 30d / 90d / All`, default **30d**) + job filter (tenant only).
- Each tile shows: label, big number, delta vs previous period (▲/▼ %), tiny sparkline or mini-bar where it adds signal.
- Empty states: friendly copy + CTA ("Post your first job", "Create screening").

## Tenant dashboard (`src/pages/Dashboard.tsx`)

Bento layout:

```text
┌──────────────┬──────────────┬──────────────┐
│ Applicants   │ Open jobs    │ Hires (range)│
│ (KPI + spark)│ (KPI)        │ (KPI + Δ)    │
├──────────────┴──────────────┼──────────────┤
│ Pipeline funnel (2×1)       │ Avg time to  │
│ horizontal bars per stage   │ hire (KPI)   │
├─────────────────────────────┼──────────────┤
│ Applications over time (2×2)│ Stale candi- │
│ area chart, range-aware     │ dates >14d   │
│                             │ (list, 5)    │
├─────────────────────────────┼──────────────┤
```

Tiles + data sources (all from existing tables — no schema changes):

- **Applicants in range** — distinct `candidates.id` via `applications.created_at` in range; sparkline of daily counts.
- **Hires in range** — applications moved to `hired` (uses `applications.updated_at` as proxy).
- **Pipeline funnel** — counts per stage from `applications`, horizontal bars colored with existing `STAGE_COLORS`.
- **Avg time to hire** — for hired apps in range, `updated_at - created_at` average in days.
- **Applications over time** — area chart of `applications.created_at` bucketed by day/week depending on range.
- **Time-in-stage** — average days each non-terminal stage currently holds (current snapshot using `updated_at`).

Existing job filter is preserved and now also scopes every tile.

## Super admin dashboard (`src/pages/admin/AdminOverview.tsx`)

Same bento shell, platform scope:

- KPIs: Companies, Active companies (had activity in range), Users, Open jobs, Applications in range, Hires in range.
- 2×2 chart: Applications-per-day across all tenants, range-aware.
- 2×1 tile: Top 5 companies by applications in range (bar list).
- 1×1 tiles: Total candidates, Total screening submissions in range.
- Keep `ScreeningAnalytics` section below the bento, restyled to match (cards become bento tiles in a secondary row).

## Implementation notes (technical)

- Add `src/components/dashboard/`:
  - `RangeFilter.tsx` — segmented control, value `"7d" | "30d" | "90d" | "all"`.
  - `KpiTile.tsx` — label, value, delta, optional sparkline (recharts `AreaChart` 40px tall, no axes).
  - `BentoGrid.tsx` — thin wrapper applying `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(140px,auto)] gap-4` and exposing `col-span-*` / `row-span-*` props.
  - `FunnelBars.tsx`, `ActivityList.tsx`, `StaleCandidates.tsx`.
- New helper `src/lib/dashboardMetrics.ts` with pure functions:
  - `bucketByDay(rows, field, range)`, `deltaVsPrevious(current, previous)`, `avgDays(rows, from, to)`, `staleApplications(rows, days)`.
- Data fetching stays client-side via existing `supabase` client — one `useEffect` per page, parallel queries, filtered in JS by range to avoid new RPCs. `applications` already selects `stage, job_id, candidate_id`; extend to also pull `created_at, updated_at`. Add `jobs.created_at` for super-admin trend.
- All colors via existing tokens (`hsl(var(--primary))`, `STAGE_COLORS`). No new tokens needed.
- Recharts only (already in deps). No new packages.
- Loading: skeleton tiles using existing `animate-pulse` pattern from `AdminOverview`.
- Responsive: bento collapses to single column under `md`; toolbar stacks; charts use `ResponsiveContainer`.

## Out of scope

- No DB migrations, no new tables, no edge functions.
- No changes to navigation, auth, or routing.
- Screening cleanup / R2 logic untouched.