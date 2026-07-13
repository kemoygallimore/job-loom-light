# Remediation Plan — Codex Prompts

Source: Principal architecture review, 2026-07-11. Work through phases in order — each prompt assumes the previous ones have landed. Run `npm run test` and `npm run lint` after every step; run `npm run worker:r2:test` after any worker change.

---

## Phase 0 — Security (do these first, same day)

### Step 1 — Lock down the R2 worker

```
In workers/r2-api/src/index.ts, fix four security holes. Do not change the response shapes the frontend depends on (src/lib/r2Worker.ts calls /presign-upload, /sign-view, /delete-object with JSON bodies).

1. /delete-object (around line 213): the auth check is
   `if (request.headers.get("Authorization") && !isAuthorized(request, env))`
   which only validates the secret WHEN a header is present — omitting the header bypasses auth entirely. Replace with an unconditional check: if (!isAuthorized(request, env)) return 401. isAuthorized already compares against env.R2_WORKER_SECRET.

2. /sign-view (around line 171): currently unauthenticated, exposing signed GET URLs to candidate resumes/videos. Require a Supabase JWT: read the Authorization: Bearer token, verify it by calling `https://<SUPABASE_URL>/auth/v1/user` with the token and the anon key (add SUPABASE_URL and SUPABASE_ANON_KEY to the Env interface and wrangler.jsonc vars). On success, fetch the caller's profile row (profiles table, select company_id where user_id = user.id) via the same REST API and reject with 403 unless the requested key starts with `<folder>/<caller company_id>/` (keys are shaped `{folder}/{companyId}/{jobId}/{ts}-{filename}`). Allow the R2_WORKER_SECRET bearer token as an alternative (server-to-server) credential.

3. /presign-upload: also unauthenticated. Public candidates DO need to upload (apply/screening flows), so gate it differently: require either (a) a valid Supabase JWT as in #2, or (b) for anonymous candidates, verify the companyId in the body corresponds to a real, open job — call Supabase REST `GET /rest/v1/jobs?id=eq.{jobId}&company_id=eq.{companyId}&status=eq.open&select=id` with the anon key and reject 403 if empty. Also enforce a max content-length hint: reject presign requests where the declared contentType is not in an allowlist per folder (resumes: pdf/doc/docx/txt; videos: video/*; documents: pdf/doc/docx/png/jpg).

4. /send-lead-email: unauthenticated open relay with HTML injection. (a) HTML-escape name, email, company, phone, message before interpolating into the email body (write a small escapeHtml helper replacing & < > " '). (b) Add basic abuse controls: reject if message > 5000 chars, reject if the Origin header is present but not in allowedOrigins.

5. corsOrigin (line ~39): for a disallowed Origin it currently returns the FIRST allowed origin, and returns "*" when no Origin header exists. Change it to return the origin only when allowlisted, otherwise return "null" (string), and never "*".

Update workers/r2-api/test/index.spec.ts: add tests proving (a) /delete-object without an Authorization header returns 401, (b) /sign-view without a valid token returns 401, (c) /sign-view with a token for company A requesting a key under company B returns 403, (d) /send-lead-email escapes `<script>` in the message. Mock the Supabase REST calls. Run `npm --prefix workers/r2-api run test -- --run`.

Finally, update src/lib/r2Worker.ts to send the Supabase session token: import the supabase client lazily is NOT possible there cleanly, so instead add an optional `accessToken?: string` parameter to uploadFileToR2, getSignedR2Url and deleteR2Objects, sent as `Authorization: Bearer <token>`; then update every caller in src/lib/ (uploadResumeToR2, uploadScreeningVideoToR2, uploadLeadFormFileToR2, uploadToStorage, getSignedVideoViewUrl, deleteScreeningVideoFromR2, fileUrl, videoUrl, invoiceUrl if applicable) and their call sites to pass `(await supabase.auth.getSession()).data.session?.access_token` where a logged-in user exists. Public candidate flows (PublicJobApplication, PublicScreening, PublicLeadForm) pass no token and rely on the open-job check.
```

### Step 2 — Purge secrets and artifacts from git

```
Repo hygiene task in the repo root. Do NOT delete files from disk unless stated — only untrack.

1. `git rm --cached .env .env.e2e` and add `.env`, `.env.e2e`, `.env.*.local` to .gitignore. Keep the files on disk. .env.e2e currently contains a real seeded test password (E2E_HR_PASSWORD) that its own header says must not be committed. tests/e2e/.env.e2e.example already exists as the template — make sure it contains ONLY placeholder values and every key present in .env.e2e.
2. Add `tests/e2e/.auth/` to .gitignore (Playwright storage-state files contain live session tokens).
3. `git rm -r --cached playwright-report test-results .artifacts` and gitignore all three (test-results may be empty; ignore it anyway). Also gitignore `supabase/.temp/`.
4. Two lockfiles exist: bun.lock and package-lock.json, and package.json declares "packageManager": "bun@1.3.14". Keep bun.lock, `git rm --cached package-lock.json` (delete it from disk too), and add package-lock.json to .gitignore.
5. Commit with message "chore: untrack env files, test artifacts, and duplicate lockfile".

Note in your summary that the E2E password and any shared credentials must be rotated manually by the owner — files remain in git history until history is rewritten; recommend (but do not run) `git filter-repo` or BFG on .env.e2e.
```

**Manual follow-ups for Step 2 (owner, not Codex):** rotate the `max@email.com` test password; confirm the test Supabase project contains no production data; decide whether to rewrite history.

---

## Phase 1 — Foundations

### Step 3 — Delete dead code and unused dependencies, re-enable unused-var linting

```
Dead-code cleanup in a Vite + React + TS repo. Verify each claim with a project-wide grep before deleting; if something IS referenced, leave it and note it.

Delete these files (confirmed unreferenced):
- src/integrations/supabase/externalClient.ts (dead duplicate Supabase client with hardcoded keys)
- src/pages/Index.tsx (not in the router in src/App.tsx)
- src/components/NavLink.tsx (imported nowhere)
- src/components/ui/form.tsx (only consumer of react-hook-form; imported nowhere)
- src/App.css if unreferenced (check src/main.tsx and index.html)

Remove from package.json dependencies (verify none are imported first): react-hook-form, @hookform/resolvers, zod, @types/dompurify (DOMPurify 3.x bundles its own types — if any file imports from "@types/dompurify" fix it). Check whether both quill and react-quill are imported; remove whichever is unused. Check embla-carousel-react, input-otp, vaul, cmdk, next-themes: these are only used by shadcn primitives under src/components/ui/ — for each, if the ui component that uses it (carousel, input-otp, drawer, command, sonner) is itself imported nowhere outside ui/, delete that ui component and the dependency (EXCEPT next-themes/sonner.tsx which is used by the app toaster — keep those).

Also delete unused asset files under src/assets: grep each filename (they contain spaces, e.g. "RH logo black.png") across src/ and index.html; delete unreferenced ones.

Then in eslint.config.js change `"@typescript-eslint/no-unused-vars": "off"` to `["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]`. Run `npx eslint .` and fix or underscore-prefix everything it reports (do not re-disable the rule).

Run `bun install` to update bun.lock, then `npm run build` and `npm run test` to prove nothing broke.
```

### Step 4 — One toast system

```
This app mounts TWO toast systems in src/App.tsx: <Toaster /> (Radix-based, from src/components/ui/toaster.tsx + src/components/ui/toast.tsx + src/hooks/use-toast.ts + src/components/ui/use-toast.ts) and <Sonner /> (sonner, src/components/ui/sonner.tsx). Roughly 50 files use one or the other. Standardize on sonner.

1. Find every import of "@/hooks/use-toast" or "@/components/ui/use-toast" and convert the call sites to sonner's API: `import { toast } from "sonner"`; toast({ title, description }) becomes toast(title, { description }); variant: "destructive" becomes toast.error(title, { description }); success-flavored titles become toast.success. Preserve the message text exactly.
2. Delete src/hooks/use-toast.ts, src/components/ui/use-toast.ts, src/components/ui/toaster.tsx, src/components/ui/toast.tsx, and remove <Toaster /> and its import from src/App.tsx (keep <Sonner />).
3. Remove @radix-ui/react-toast from package.json and run bun install.
4. Update any tests that mock use-toast (grep tests and *.test.tsx for "use-toast").
Run npm run lint, npm run test, npm run build.
```

### Step 5 — Turn on strictNullChecks

```
In tsconfig.app.json and tsconfig.json, enable "strictNullChecks": true (leave noImplicitAny false for now; that is a later step). Then fix every resulting compiler error across src/, tests/e2e/, and playwright config until `npx tsc -p tsconfig.app.json --noEmit` passes clean.

Ground rules for the fixes:
- Prefer real narrowing (early returns, optional chaining, ?? fallbacks) over non-null assertions. Use `!` only where invariants are structurally guaranteed and add no more than a handful.
- Supabase rows: generated types in src/integrations/supabase/types.ts already mark nullable columns — let those flow; do not cast to any to silence errors. Where code does `(supabase as any)` (e.g. src/hooks/useFeatureFlags.ts), check whether the table now exists in the generated types and remove the cast if possible; if the table is genuinely missing from types, leave the cast but add a TODO comment naming the table.
- profile/role from useAuth are nullable by design — pages must handle the null case explicitly (most already early-return; add guards where missing).
- Do not change runtime behavior: this is a types-only migration. If a null-handling fix would change behavior (e.g. code that would have crashed), keep the fix but list it in your summary.

Fix files in dependency order: src/lib first, then hooks, then components, then pages. After tsc is clean, run npm run test and npm run build.
```

---

## Phase 2 — Architecture

### Step 6 — Adopt React Query + add an error boundary

```
@tanstack/react-query v5 is installed and QueryClientProvider is already mounted in src/App.tsx, but zero components use it — every page hand-rolls useState/useEffect/load(). Migrate the three heaviest pages and establish the pattern; do NOT migrate everything.

1. In src/App.tsx configure the QueryClient with sensible defaults: staleTime 30_000, retry 1, refetchOnWindowFocus false.
2. Create src/lib/queryKeys.ts exporting a typed key factory: e.g. keys.pipeline(jobId, filters), keys.candidates(view, filters), keys.candidate(id), keys.jobsOpen(), keys.tags(candidateIds).
3. Migrate src/pages/Pipeline.tsx: replace the load()/loadOptions() useEffect plumbing with useQuery calls (the get_job_pipeline RPC query keyed on jobId+search+screening filters+sort, and the open-jobs/candidates option queries). Mutations (moveStage, createApplication, reject flows) become useMutation with optimistic updates via onMutate/onError rollback for the drag-and-drop stage move, and query invalidation instead of manual load() calls. Keep the localStorage filter persistence exactly as is.
4. Migrate src/pages/Candidates.tsx and src/pages/CandidateProfile.tsx the same way (queries for the candidate list + tags via fetchTagsForCandidates, candidate detail + timeline data; mutations invalidate).
5. Preserve every user-visible behavior: loading skeletons, empty states, toast messages, the missing-role retry effect in Candidates.
6. Add a top-level error boundary: create src/components/ErrorBoundary.tsx (class component, renders a centered card with "Something went wrong", the error message, and a "Reload" button) and wrap the <Routes> tree in src/App.tsx with it.
7. Update src/pages/CandidateProfile.test.tsx and any other affected tests — wrap renders in a QueryClientProvider test helper (create src/test/renderWithProviders.tsx if useful).

Run npm run test and npm run build. In your summary, document the pattern so remaining pages can be migrated the same way later.
```

### Step 7 — Route-level code splitting

```
src/App.tsx statically imports 35+ pages, so public candidates download the entire admin/billing bundle. Introduce React.lazy code splitting in src/App.tsx:

1. Keep eagerly imported: Auth, AppLayout, NotFound (small, needed immediately).
2. Convert every other page import to React.lazy(() => import(...)).
3. Wrap <Routes> in a single <Suspense> whose fallback reuses the existing "Loading your workspace…" spinner markup from ProtectedRoutes (extract that spinner into src/components/FullPageLoader.tsx and use it in both places).
4. Heavy libraries must land in the right chunks: recharts is used by Dashboard/AdminOverview/KpiTile, quill by RichTextEditor, @hello-pangea/dnd by Pipeline. After building, run `npm run build` and inspect the dist output: confirm the entry chunk no longer contains recharts or quill (check chunk sizes; entry should shrink substantially). Report before/after entry chunk size.
5. Verify no route flashes NotFound during lazy load and that direct deep links (e.g. /:companySlug/careers, /apply/:jobId) still render.

Run npm run test and npm run build.
```

### Step 8 — Extract shared stage metadata and common UI components

```
Cross-cutting extraction task.

1. Create src/lib/stages.ts as the single source of truth for pipeline stages. It exports:
   - PIPELINE_STAGES: ordered array of the PipelineStage union already defined in src/lib/pipeline.ts (applied, shortlisted, screening, scheduling, 1st_interview, 2nd_interview, offer, hired, rejected — check pipeline.ts for the authoritative list; note some files also use an "interview" legacy key, keep it as an alias entry).
   - STAGE_LABELS: Record<stage, string> human labels ("1st_interview" -> "1st Interview").
   - STAGE_COLORS: Record<stage, string> Tailwind classes. Seven files currently declare their own STAGE_COLORS/label maps with slightly different palettes: src/pages/Candidates.tsx, src/pages/Pipeline.tsx, src/pages/CandidateProfile.tsx, src/pages/Dashboard.tsx, src/components/pipeline/CandidatePanel.tsx, src/components/pipeline/KanbanCard.tsx, src/components/candidate/CandidateFilters.tsx (grep STAGE_ to find all). Reconcile to ONE palette (use the Candidates.tsx palette as canonical since it has light+dark variants) and delete every local copy.
2. Create src/components/shared/StageBadge.tsx rendering a Badge with the stage color + label, and use it everywhere a stage chip is rendered.
3. Create src/components/shared/PageHeader.tsx (title, optional description, optional actions slot) and adopt it in at least: Candidates, Jobs, Pipeline, Forms, Billing, Team. Match existing visual style — this is a consolidation, not a redesign.
4. Create src/components/shared/ConfirmDialog.tsx wrapping AlertDialog (props: trigger, title, description, confirmLabel, destructive?, onConfirm) and adopt it for the delete confirmations in Candidates, Jobs, and Forms.
5. Move src/pages/screening/ScreeningAnalytics.tsx to src/components/screening/ScreeningAnalytics.tsx (it is imported as a component by src/pages/admin/AdminOverview.tsx, not routed) and fix imports.

No visual changes intended. Run npm run test, npm run lint, npm run build, and skim the affected pages for identical rendering.
```

### Step 9 — Single storage module

```
Consolidate the R2 upload/download helpers under src/lib/storage/.

Current state: src/lib/r2Worker.ts is the core (uploadFileToR2, getSignedR2Url, deleteR2Objects); thin wrappers uploadResumeToR2.ts, uploadScreeningVideoToR2.ts, uploadLeadFormFileToR2.ts, uploadToStorage.ts duplicate each other with inconsistent result shapes (filename vs fileName); plus getSignedVideoViewUrl.ts, deleteScreeningVideoFromR2.ts, fileUrl.ts, videoUrl.ts, invoiceUrl.ts.

1. Create src/lib/storage/index.ts exporting:
   - uploadToStorage({ file, category: "resume"|"video"|"document", companyId, candidateId, jobId?, fieldId?, accessToken? }) returning ONE canonical shape { bucket, key, filename, contentType, size } — merge the logic of all four wrappers (video keeps the fallbackContentType "video/webm" and lowercased-email candidateId behavior; resume keeps jobId "candidate-upload" default).
   - getSignedViewUrl(bucket, key, accessToken?) and deleteObjects(bucket, keys, accessToken?) re-exported from the core.
   - The bucket constants and R2UploadFolder type.
2. Keep r2Worker.ts as the internal transport (move it to src/lib/storage/r2Client.ts).
3. Update every call site (grep for each old module name), delete the old files, and update the existing unit tests (src/lib/r2Worker.test.ts and any wrapper tests) to target the new module paths — keep the test cases, they encode behavior.
4. Where call sites consumed fileName/fileType/fileSize from uploadToStorage's old shape, adapt them to the canonical shape.

Run npm run test and npm run build.
```

### Step 10 — Split the god pages (one prompt per page; run for each)

```
Refactor <TARGET> into feature modules without changing behavior. TARGET is one of (run this prompt once per file, in this order):
  1. src/pages/apply/PublicJobApplication.tsx (~37KB, public-facing)
  2. src/pages/forms/FormBuilder.tsx (~28KB)
  3. src/pages/forms/FormSubmissions.tsx (~28KB)
  4. src/pages/CandidateProfile.tsx (~25KB)
  5. src/pages/admin/AdminCompanyDetail.tsx (~24KB, 18 `any` casts)

Method:
1. Read the whole file first and list its responsibilities (data access, derived state, sub-views, dialogs).
2. Extract all Supabase queries/mutations into src/features/<feature>/api.ts with typed functions (use the generated Database types from src/integrations/supabase/types.ts; eliminate `any` casts — if a cast exists because generated types lack a table/RPC, add a narrow local interface instead of any).
3. Extract types into src/features/<feature>/types.ts.
4. Extract each visually distinct section (e.g. for PublicJobApplication: job header, application form fields, file-upload section, screening questions step, success screen) into components under src/features/<feature>/components/, each receiving typed props — no component over ~250 lines.
5. The page file becomes orchestration only: data loading, top-level state, layout composition. Target under 300 lines.
6. Zero behavior change: identical markup structure, class names, toasts, and validation messages. Existing tests (e.g. src/pages/CandidateProfile.test.tsx) must pass unmodified except for import paths.

Run npm run test, npm run lint, npm run build after each page.
```

---

## Phase 3 — Hygiene

### Step 11 — Consolidate stray SQL into real migrations

```
The canonical schema lives in supabase/migrations/, but docs/ contains ad-hoc SQL that was applied by hand: docs/billing-stage-f-migration.sql, docs/billing-stage-g-email-migration.sql, docs/billing-stage7-domain-migration.sql, docs/platform-policies-migration.sql, docs/stage1-users-migration.sql.

For each file: diff its statements against the migration chain (grep supabase/migrations/ for the table/column/policy names it creates). 
- If every statement is already covered by a real migration, delete the docs SQL file and note it.
- If statements are NOT covered, create a new timestamped migration in supabase/migrations/ (use the next timestamp after the latest, format YYYYMMDDHHMMSS_description.sql) containing the missing statements rewritten to be idempotent (CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before CREATE POLICY, ADD COLUMN IF NOT EXISTS) so applying it against the already-hand-patched database is a no-op.
- Every new table must get ENABLE ROW LEVEL SECURITY plus policies matching the multi-tenant pattern used in existing migrations (company_id scoping via profiles, super_admin via user_roles).

Do NOT run migrations against any database — file changes only. Summarize per file: covered / migrated / needs-owner-decision. Also update the deploy docs (docs/billing-stage-*-deploy.md, docs/stage1-users-deploy.md) to point at the migration files instead of inline SQL.
```

### Step 12 — Accessibility pass on public candidate pages

```
Accessibility hardening for the PUBLIC pages only (legal exposure is highest there): src/pages/apply/PublicJobApplication.tsx (or its refactored feature components), src/pages/screening/PublicScreening.tsx, src/pages/careers/CareersPage.tsx, src/pages/careers/JobDetailsPage.tsx, src/pages/forms/PublicLeadForm.tsx, src/pages/feedback/PublicFeedback.tsx, src/components/forms/LeadFormRenderer.tsx, src/components/feedback/StarRating.tsx.

For each:
1. Every input gets an associated <Label htmlFor> (the shadcn Label component is already available) — no placeholder-as-label.
2. Every icon-only button gets aria-label; decorative icons get aria-hidden="true".
3. Images (company logos) get meaningful alt text or alt="" if decorative.
4. Error/validation messages: associate with fields via aria-describedby and set aria-invalid on the field; announce submission errors in a container with role="alert".
5. StarRating must be keyboard operable: render as a radiogroup (role="radiogroup", each star role="radio", aria-checked, arrow-key navigation, visible focus ring) while keeping the current visuals.
6. File-upload dropzones: ensure the hidden input is reachable and the visible trigger is a real <button>.
7. Landmark structure: exactly one <main> per page; headings in order (single h1).
8. Verify focus states are visible (Tailwind ring classes) on all interactive elements; add where missing.

No visual redesign — additions must be invisible to mouse users. Run npm run test and npm run build; list per file what changed.
```

### Step 13 — Naming, structure, and metadata cleanup

```
Final convention sweep:

1. Hooks folder: rename src/hooks/use-toast.ts is gone (deleted earlier); rename src/hooks/use-mobile.tsx to src/hooks/useIsMobile.ts (export useIsMobile; update the shadcn ui/ imports that reference it). One naming style: camelCase use*.ts for all hooks.
2. Move root-level strays into folders: src/components/RichTextEditor.tsx + src/components/rich-text-editor.css -> src/components/shared/; src/components/CandidateFileUpload.tsx -> src/components/candidate/. Fix imports.
3. Rename asset files to kebab-case without spaces (e.g. "RH logo black.png" -> rh-logo-black.png) and update imports.
4. package.json: set name to "rizonhire", version "0.1.0".
5. Replace the boilerplate README.md with a real one: what the app is, prerequisites (bun, supabase CLI, wrangler), env vars (reference tests/e2e/.env.e2e.example and .env keys VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_UPLOAD_BACKEND_URL), the npm scripts including worker:r2:*, how to run unit and e2e tests, and the deploy targets (Vercel + Cloudflare Worker + Supabase).
6. Normalize the worker indentation (workers/r2-api/src/index.ts mixes tabs and spaces in the /send-lead-email block) — spaces throughout.
7. Delete the vestigial `const filtered = applications;` alias in src/pages/Pipeline.tsx if still present (use applications directly).

Run npm run lint, npm run test, npm run build.
```

### Step 14 (optional, later) — Full strict mode

```
tsconfig.app.json currently has strictNullChecks true but strict false. Enable "strict": true (which adds noImplicitAny, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, alwaysStrict) in tsconfig.app.json and tsconfig.json (remove the now-redundant noImplicitAny/strictNullChecks overrides). Fix all compiler errors until `npx tsc -p tsconfig.app.json --noEmit` is clean, following the same ground rules as the strictNullChecks migration: real types over casts, no new `any`, no behavior changes. Prioritize eliminating the remaining `as any` casts on supabase calls by regenerating types (`npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`) if tables are missing — if you cannot regenerate, use narrow local interfaces. Report the final count of remaining `any` occurrences in src/.
```

---

## Sequencing summary

| Phase | Steps | Risk | Est. effort |
|---|---|---|---|
| 0 — Security | 1–2 | Worker change needs deploy + smoke test of uploads | 1–2 days |
| 1 — Foundations | 3–5 | strictNullChecks touches many files, mechanical | 3–5 days |
| 2 — Architecture | 6–10 | Behavior-preserving refactors; test after each | 1–2 weeks incremental |
| 3 — Hygiene | 11–14 | Low | 2–3 days |

Rules of engagement for every Codex run: one step per branch/PR, run `npm run lint && npm run test && npm run build` (plus `npm run worker:r2:test` for step 1) before finishing, and no drive-by refactors outside the step's scope.
