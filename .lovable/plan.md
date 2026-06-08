
# Add "Time to Fill" to the dashboard bento

Add a new KPI tile on the tenant dashboard (`src/pages/Dashboard.tsx`) showing the average **Time to Fill** for jobs, with the same look as the existing "Avg time to hire" tile (value, "days" suffix, delta vs previous period).

## Definition

Time to Fill = number of days between when a job was opened and when it was filled, counted only for jobs where a candidate reached the **hired** stage.

Mapping to existing data (no schema change needed):

- **Opened at** → `jobs.created_at` (the moment the role exists in the system).
- **Filled at** → the earliest `applications.updated_at` for that job where `applications.stage = 'hired'`.
- A job is included only if it has at least one hired application.

The metric is the average of `filled_at - opened_at` (in days) across those jobs.

> Note: the `jobs` table currently has no `opened_at` / `closed_at` columns, so `created_at` and the first hire date are the best available proxies. This matches how "Avg time to hire" is already computed today. If you later want true open/close timestamps, that's a separate schema change.

## Scope of the metric

- Respects the existing **time range** filter (7d / 30d / 90d / All): a job counts in the current period if its hire date falls inside the range; previous-period delta uses the prior window of the same length.
- Respects the existing **job filter** dropdown: if a specific job is selected, the tile shows that single job's time to fill (or "—" if not yet hired).
- Shows a Δ% badge vs the previous period, like other tiles. "All" range hides the delta (same as today).
- Empty state: when no jobs were filled in the period, show "—" and no delta.

## Bento placement

Insert the new tile next to "Avg time to hire" so the two velocity metrics sit together. Layout becomes:

```text
[ Applicants ] [ Applications ] [ Open jobs ] [ Hires ]
[ Pipeline funnel (2x2)        ] [ Avg time to hire ]
[                              ] [ Time to fill     ]   <-- new
[ Applications over time (2x2) ] [ Stale candidates ]
```

Both "Avg time to hire" and "Time to fill" become `colSpan={2}` single-row tiles stacked under the funnel, keeping the grid balanced on `lg` and collapsing cleanly on mobile.

## Implementation notes (technical)

- New pure helper in `src/lib/dashboardMetrics.ts`:
  - `timeToFill(apps, jobs, from, to)` → returns `number | null` (average days). Internally:
    1. Group hired applications by `job_id`, take the earliest `updated_at` per job as `filled_at`.
    2. Keep only jobs whose `filled_at` falls in `[from, to)` (or all when `from` is null).
    3. For each kept job, compute `(filled_at - job.created_at) / 86400000`.
    4. Average; return `null` when the set is empty.
- In `Dashboard.tsx`:
  - Compute `tftCurrent = timeToFill(scopedAll, jobs, from, null)` and `tftPrev = timeToFill(scopedAll, jobs, prevFrom, prevTo)`.
  - Render a new `<BentoTile colSpan={2}>` with `<KpiTile label="Time to fill" value={tftCurrent?.toFixed(1) ?? "—"} suffix={tftCurrent != null ? "days" : undefined} delta={range==="all" ? null : deltaPct(tftCurrent ?? 0, tftPrev ?? 0)} icon={CalendarCheck} iconAccent="bg-cyan-500/10 text-cyan-600" />`.
  - Adjust the "Avg time to hire" tile from `colSpan={2}` row-spanning context to a `colSpan={2}` single row so the two stack neatly under the funnel.
- No new packages, no DB changes, no edge functions.
- Glossary: add a short "Time to Fill" entry in `docs/03-user-guide.md` with the same definition above so users understand the number.

## Out of scope

- No new `opened_at`/`closed_at` columns on `jobs`.
- No changes to the super-admin dashboard (can be added later if you want platform-wide time-to-fill).
- No changes to pipeline, jobs, or candidates pages.
