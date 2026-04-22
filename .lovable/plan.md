

## Plan: Candidate Tags

Allow company admins to attach reusable, color-coded tags (e.g. "Do not hire", "Top talent", "Rehire") to candidates. Tags appear anywhere a candidate is shown — pipeline cards, candidate list, candidate profile — so any recruiter immediately sees prior flags.

### 1. Database schema

Two new tables (multi-tenant, scoped by `company_id`):

**`candidate_tags`** — per-company tag library
- `id` uuid PK
- `company_id` uuid (not null)
- `label` text (not null)
- `color` text (e.g. `red`, `green`, `amber`, `blue`, `gray`)
- `created_by` uuid
- `created_at` timestamptz
- Unique on `(company_id, lower(label))`

**`candidate_tag_assignments`** — links tags to candidates
- `id` uuid PK
- `company_id` uuid (not null)
- `candidate_id` uuid (not null)
- `tag_id` uuid (not null, references `candidate_tags`)
- `assigned_by` uuid
- `assigned_at` timestamptz
- Unique on `(candidate_id, tag_id)`

### 2. RLS policies

| Table | Action | Who | Rule |
|---|---|---|---|
| `candidate_tags` | SELECT | authenticated | same `company_id` |
| `candidate_tags` | INSERT/UPDATE/DELETE | authenticated | same company AND `has_role(auth.uid(),'admin')` |
| `candidate_tag_assignments` | SELECT | authenticated | same `company_id` |
| `candidate_tag_assignments` | INSERT/DELETE | authenticated | same company AND `has_role(auth.uid(),'admin')` |

(Only admins create or assign tags. All recruiters in the company can see them.)

### 3. Tag management UI (admin-only)

New page `src/pages/admin/CandidateTagsAdmin.tsx` reachable from the existing Admin area:
- List of tags for the current company.
- Form to create a tag (label + color picker with 6 preset colors).
- Edit / delete actions.
- Hidden from non-admin users.

### 4. Tag assignment UI (all recruiters in company)

New component `src/components/candidate/CandidateTagsBar.tsx`:
- Renders pill badges of currently assigned tags using the tag color.
- "+ Add tag" popover lists company tags (multi-select with checkboxes).
- "x" on each pill removes the assignment.
- Shows read-only badges for non-admins if you later want to gate assignment; for now: any recruiter in the company can assign/unassign (admins still solely manage the tag library itself).

### 5. Where tags are displayed

- **Candidate profile** (`src/pages/CandidateProfile.tsx`) — full `CandidateTagsBar` near the header.
- **Candidates list** (`src/pages/Candidates.tsx`) — inline pills in the row.
- **Pipeline kanban card** (`src/components/pipeline/KanbanCard.tsx`) — small color dots / pills near the name so flags like "Do not hire" are instantly visible.
- **Candidate panel** (`src/components/pipeline/CandidatePanel.tsx`) — full bar at the top.
- **Public application flow is untouched** (tags are internal-only).

### 6. Data fetching

Single query helper that, given a list of candidate IDs, returns a map `candidateId -> tags[]` joining `candidate_tag_assignments` with `candidate_tags`. Used by Pipeline, Candidates list, and CandidateProfile to avoid N+1 calls.

### 7. Validation checklist

- Admin can create/edit/delete tags; non-admin cannot see the management page.
- Recruiter can assign/remove tags on a candidate.
- "Do not hire" tag set on a candidate is visible on:
  - their pipeline card (any job),
  - candidate list row,
  - candidate profile,
  - candidate side panel.
- Tags never leak across companies (verified via RLS company scoping).
- No tags appear on public careers / apply pages.

