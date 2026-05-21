# Candidates & Video Screening UX updates

Three focused changes across the candidate list, candidate profile, and video screening pages.

## 1. Candidates list (`src/pages/Candidates.tsx`)

- Add a toggle (segmented control / Tabs: "Active Jobs" | "All Candidates") near the header.
- Default = "Active Jobs": only show candidates whose latest application is for a job with `status = 'open'`.
  - Fetch job status alongside the existing `jobs(title)` join (`jobs(title, status)`) and store it on the enriched record.
  - Filter the candidate list accordingly before the existing search/filter pipeline runs.
- "All Candidates" keeps current behavior (every candidate in the system).
- Remove the person/user avatar circle next to each candidate's name in the table (the round `User` icon shown in the attached screenshot). Keep the name, repeat-applicant badge, and tags exactly as-is. Empty-state icon stays.

## 2. Candidate profile tabs (`src/pages/CandidateProfile.tsx`)

- The 4-tab `TabsList` (`Notes`, `Interview Feedback`, `Resume History`, `Documents`) overlaps on mobile because it uses `grid-cols-4` with long labels.
- Fix: make the `TabsList` horizontally scrollable on small screens and stack labels safely.
  - Replace `grid w-full grid-cols-4 max-w-2xl` with a flex layout that wraps/scrolls on narrow viewports: `flex w-full overflow-x-auto no-scrollbar h-auto`, and switch to `grid-cols-4` only at `sm:` and up.
  - Add `whitespace-nowrap` and `flex-1 sm:flex-none` (or equivalent) on each `TabsTrigger` so text never overlaps.
- No behavior changes — only the `TabsList` / `TabsTrigger` classes.

## 3. Video Screening jobs page (`src/pages/screening/ScreeningJobs.tsx`)

- Add an "Active" | "All" toggle (matching the candidates page style) at the top of the table.
- Default = "Active": only show screening jobs where `expires_at > now()` (uses the existing `isExpired` helper).
- "All" shows every screening job (current behavior).
- Update the empty-state copy to reflect the active filter when applicable.

## Out of scope

- No database / RLS changes.
- No changes to ScreeningSubmissions (per-job detail page) — the toggle lives on the screening jobs index, mirroring "candidates list" semantics.
- No layout, validation, or business-logic changes beyond what's listed.

## Technical notes

- All filters are client-side using already-loaded data; no extra Supabase queries except adding `status` to the existing jobs join in Candidates.
- Toggle implemented with shadcn `Tabs` (value-controlled) to stay consistent with the existing design system tokens.