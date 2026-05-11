
## Scope

Four changes across the public application flow, candidate views, and a new policy page.

---

### 1. Optional LinkedIn profile link on the application

**Database**
- Add `linkedin_url text NULL` to `public.candidates`.

**Public apply form (`src/pages/apply/PublicJobApplication.tsx`)**
- Add a LinkedIn URL input below Phone, clearly labeled **optional** (no asterisk).
- Validate only when filled: must look like a LinkedIn URL (`/^https?:\/\/(www\.)?linkedin\.com\/.+/i`).
- Persist on insert and update paths next to the other candidate fields.

**Display on candidate page (`src/pages/CandidateProfile.tsx`)**
- Extend the `Candidate` interface with `linkedin_url`.
- In the contact grid, show a LinkedIn row when present (Linkedin icon + external link, opens in new tab).

**Display on pipeline candidate panel (`src/components/pipeline/CandidatePanel.tsx`)**
- Fetch `linkedin_url` for the candidate (small extra select against `candidates`) and render a row alongside email when present.

---

### 2. Remove "Add Candidate" from the Candidates page

In `src/pages/Candidates.tsx`:
- Remove the **Add Candidate** button, the create/edit `Dialog`, and all related state (`open`, `editCandidate`, `name`, `email`, `phone`, `resumeFile`, `handleSave`, `openEdit`, `resetForm`) plus the `uploadResumeToR2` import that becomes unused.
- Keep the **edit pencil** out of the row actions only if it depended on the same dialog; otherwise leave row actions (view / delete) intact. The plan removes only creation/edit-via-dialog flow per the request ("New candidates should only be added through the public link"). Deletion stays.
- Keep filters, search, table, and tag display untouched.

---

### 3. Mobile apply button cleanup on the public job page

The page that shows the bottom sticky mobile button is `src/pages/careers/JobDetailsPage.tsx` (the apply form itself has only one submit button). Remove the `sm:hidden fixed bottom-0 ...` floating Apply Now block. Keep the inline **Apply Now** button inside the "Interested in this role?" section as the single CTA on every viewport.

---

### 4. Data Protection agreement on the apply form

**New page**
- Create `src/pages/legal/DataProtection.tsx` with a clean, branded long-form policy page covering: what data we collect, lawful basis, storage (private R2, RLS), retention, sharing with the hiring company only, candidate rights (access, correction, deletion), and contact. Use existing typography/`prose` styling so it matches the public pages.
- Add route `/legal/data-protection` in `src/App.tsx` (public, no auth).

**Apply form (`PublicJobApplication.tsx`)**
- Add a required checkbox at the bottom of the form, just above the Submit button:
  > I agree to the [Data Protection Agreement](…) and consent to my information being processed as described.
- The link uses `<a href="/legal/data-protection" target="_blank" rel="noopener noreferrer">`.
- Validation: block submit until checked; show inline error if not.
- Disable the Submit button while unchecked, in addition to the existing `submitting` state.

---

## Technical notes

- Migration uses an `ALTER TABLE` only — no RLS change needed (existing policies cover the new column).
- `linkedin_url` is rendered as a normal anchor; no scraping or external API calls.
- The Data Protection page is a static React component, not stored in the DB.
- All UI uses existing semantic tokens; no new colors introduced.
