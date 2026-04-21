
## Plan

### 1. Fix guest video screening submissions

The current public screening page submits to `screening_submissions` without a logged-in user. Since it works when signed in but not in incognito, the likely blocker is an RLS policy on the external database.

I will provide SQL for the external database that ensures:

- Anonymous users can read active screening jobs by link.
- Anonymous users can insert screening submissions.
- The insert is still constrained so submissions must belong to an active screening job and matching company.
- Authenticated recruiters can continue viewing/updating submissions for their own company.

Recommended SQL for the external database:

```sql
ALTER TABLE public.screening_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view screening jobs by link" ON public.screening_jobs;
DROP POLICY IF EXISTS "Public can create submissions" ON public.screening_submissions;

CREATE POLICY "Public can view active screening jobs"
ON public.screening_jobs
FOR SELECT
TO anon
USING (expires_at > now());

CREATE POLICY "Public can submit active screening responses"
ON public.screening_submissions
FOR INSERT
TO anon
WITH CHECK (
  privacy_consent = true
  AND EXISTS (
    SELECT 1
    FROM public.screening_jobs sj
    WHERE sj.id = screening_job_id
      AND sj.company_id = company_id
      AND sj.expires_at > now()
  )
);
```

I will also improve the public screening submit error handling so if the upload succeeds but the database insert fails, the toast clearly reports the database/RLS error instead of a generic failure.

### 2. Change the careers route to `/{companySlug}/careers`

I will update public career routing from:

```text
/careers/:companySlug
/careers/:companySlug/:jobId
```

to:

```text
/:companySlug/careers
/:companySlug/careers/:jobId
```

Files to update:

- `src/App.tsx`
- `src/pages/Jobs.tsx`
- `src/pages/careers/CareersPage.tsx`
- `src/pages/careers/JobDetailsPage.tsx`

I will also add backward-compatible redirects from the old routes to the new routes so existing shared links do not immediately break:

```text
/careers/:companySlug -> /:companySlug/careers
/careers/:companySlug/:jobId -> /:companySlug/careers/:jobId
```

### 3. Make “Apply Now” redirect to the individual application page

The job details page currently opens an application modal. I will remove the modal-based application flow from `JobDetailsPage.tsx` and change both Apply Now buttons to redirect to:

```text
/apply/:jobId
```

This will make the public job details page behave consistently with the job application link already copied from the Jobs table.

### 4. Hide raw WYSIWYG HTML in job tables and previews

The Jobs table currently renders:

```ts
job.description?.slice(0, 60)
```

That is why users see raw HTML like:

```html
<p><strong>Job Summary</strong></p>
```

I will add a small utility for converting rich text HTML into clean plain text snippets, then use it anywhere descriptions appear in a table, card preview, or truncated summary.

Likely utility:

```ts
export function htmlToPlainText(html?: string | null): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
```

Files to update:

- `src/pages/Jobs.tsx`
- `src/pages/careers/CareersPage.tsx`
- Any other table/preview found using raw `description`.

### 5. Render WYSIWYG formatting correctly on `/apply/:jobId`

The `/apply/:jobId` page already uses `dangerouslySetInnerHTML`, but the styling is likely not fully applying because Tailwind typography styles are not enabled in the Tailwind config even though `@tailwindcss/typography` is installed.

I will update `tailwind.config.ts` to enable the typography plugin:

```ts
plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")]
```

Then I will ensure the job description on:

- `src/pages/apply/PublicJobApplication.tsx`
- `src/pages/careers/JobDetailsPage.tsx`

uses consistent rich-text classes so headings, bold text, lists, paragraphs, and spacing display properly.

### 6. Clean up public application flow

Since the standalone `/apply/:jobId` page is now the source of truth, I will remove unused modal form state/imports from `JobDetailsPage.tsx`, including:

- Dialog imports
- Application form state
- Resume upload modal logic
- Duplicate submit handler inside the job details page

The actual application submission flow will remain in `PublicJobApplication.tsx`.

### 7. Validation checklist

After implementation, verify:

- Incognito users can open `/screen/:linkId`, record, and submit a screening.
- Signed-in users can still view screening submissions.
- “Copy Careers Link” now copies `/{companySlug}/careers`.
- Old career links redirect to the new slug format.
- Job cards and job tables show clean text, not HTML tags.
- Apply Now redirects to `/apply/:jobId`.
- `/apply/:jobId` displays rich formatted job descriptions correctly.
