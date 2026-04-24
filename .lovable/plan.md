

## Plan: Five fixes

### 1. Resume re-upload archives a version (existing candidate re-applies)

In `src/pages/apply/PublicJobApplication.tsx`, after a successful resume upload (in BOTH the existing-candidate and new-candidate branches), insert a row into `candidate_files` with `category: 'resume'`, the new `bucket`, `file_key`, `file_name`, `file_type`, `file_size`, and the current `job_id`. The candidate's `resume_*` columns continue to be overwritten with the latest upload — so the profile always shows the most recent resume, while `ResumeHistory` (which reads `candidate_files`) automatically displays every prior version with the job it was submitted for.

The existing public RLS policy `Public can create candidate resume files` already permits this insert from anonymous users (it requires `category = 'resume'` and a valid candidate/open-job pair).

### 2. Admin "Add additional document" — fix "Invalid job_id or candidate_id"

Root cause: `src/components/candidate/CandidateDocuments.tsx` calls `uploadToStorage({ ..., jobId: "manual" })`. The Cloudflare Worker at `api.rizonhire.com/presign-upload` validates that `jobId`/`candidateId` are UUIDs and rejects the literal `"manual"` — that's the source of the error message (it is NOT an RLS problem; the DB insert never runs).

Fix in `src/lib/uploadToStorage.ts`: make `jobId` optional. When uploading a `document`, omit `jobId` from the request body (the worker should treat it as optional for documents). Update `CandidateDocuments.tsx` to stop passing `jobId: "manual"`.

If the worker still rejects a missing `jobId`, fall back to sending the `candidateId` as the path discriminator only (folder layout: `documents/{companyId}/{candidateId}/...`). The DB row already stores `job_id: null`, which the existing RLS allows for authenticated users in the same company.

### 3. Sidebar collapse button at the top

In `src/components/AppLayout.tsx`, move the collapse toggle (currently rendered between the nav and the user block, lines 153–159) into the logo header row at the top of the sidebar (next to the logo). Keep it desktop-only (`hidden lg:flex`). The icon still flips with `rotate-180` when collapsed. Remove the old bottom placement.

### 4. Pipeline horizontal scrollbar at the top

In `src/pages/Pipeline.tsx`, the kanban currently uses a single `overflow-x-auto` wrapper at the bottom. Add a thin "top scrollbar" that mirrors the kanban's horizontal scroll:

- Wrap the kanban in a container with `ref={kanbanRef}`.
- Above the kanban, render a `<div ref={topScrollRef} className="overflow-x-auto" onScroll={...}>` containing a single inner `<div style={{ width: kanbanScrollWidth }} className="h-3" />`.
- Sync both directions with `onScroll` handlers and a `ResizeObserver` to keep the inner width in sync with `kanbanRef.current.scrollWidth`.

Result: a horizontal scrollbar visible at the top of the board, plus the existing one at the bottom, both controlling the same view.

### 5. Remove the `testadmin@email.com` gate — all admins see all modules

- `src/App.tsx`: delete `TEST_ADMIN_EMAIL`, `ATSGuard`, `DefaultRedirect`. Replace `<DefaultRedirect />` with `<Dashboard />`. Remove every `<ATSGuard>` wrapper around `/jobs`, `/candidates`, `/candidates/:id`, `/pipeline`, `/admin/candidate-tags` so they render directly. In `AuthRoute`, redirect any signed-in non-super-admin to `/dashboard`.
- `src/components/AppLayout.tsx`: remove `TEST_ADMIN_EMAIL` and `isTestAdmin`. For non-super-admins, show **both** `atsNavItems` and `screeningNavItems` (plus the Assessment bottom link).

Also update memory: `mem://constraints/ats-access` and the Core line in `mem://index.md` to remove the ATS-restriction rule.

### Files to change

- `src/pages/apply/PublicJobApplication.tsx` — archive resume version on every submit
- `src/lib/uploadToStorage.ts` — make `jobId` optional, omit for documents
- `src/components/candidate/CandidateDocuments.tsx` — stop sending `jobId: "manual"`
- `src/components/AppLayout.tsx` — collapse button at top; remove test-admin gating
- `src/pages/Pipeline.tsx` — top horizontal scrollbar synced with kanban
- `src/App.tsx` — remove `ATSGuard` / `DefaultRedirect` / test-admin checks
- `mem://index.md`, `mem://constraints/ats-access` — remove ATS restriction note

### No database migrations required

All required RLS policies already exist:
- `candidate_files` public resume insert policy already permits the version-archive insert from `/apply/:jobId`.
- `candidate_files` authenticated insert policy already permits admin-uploaded documents with `job_id: null`.

### Validation checklist

- Re-apply with the same email to a different job → candidate row's `resume_*` updates to the new file; **Resume History** tab shows both old and new entries with the correct job titles.
- Admin opens a candidate profile and uploads a document → no "Invalid job_id" error; document appears in the Documents list and is viewable.
- Sidebar: collapse toggle is at the top (next to logo); clicking it collapses to icon-only and the toggle stays visible.
- Pipeline: horizontal scrollbars appear both above and below the columns; dragging either scrolls the board.
- Logging in with any admin (not just `testadmin@email.com`) shows Dashboard, Jobs, Candidates, Pipeline, Candidate Tags, Video Screening, and Assessment in the sidebar and all routes load.

