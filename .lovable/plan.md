## Goal

Let admins delete:
1. **Individual screening submissions** — already partially exists in `ScreeningSubmissions.tsx` (DB row only). Extend it to also delete the video from R2.
2. **An entire screening job** — new action that cascades: every submission's R2 video + every submission DB row + the screening_jobs row.

Both actions are admin-only and require a confirmation prompt (already using shadcn `AlertDialog` for individual deletes; same pattern for job delete).

## Out of scope

No schema changes. RLS already grants `DELETE` to admins on both `screening_jobs` and `screening_submissions` (scoped by `company_id`). No new tables, no new edge functions — Worker handles R2.

---

## Architecture

R2 storage is fronted by the Cloudflare Worker at `https://api.rizonhire.com`. You'll add a new endpoint there:

```text
POST /delete-object
Body: { "bucket": "silverweb-ats-videos", "key": "videos/<companyId>/<jobId>/..." }
Resp: { "success": true }
```

(or batch: `{ "bucket", "keys": [...] }` — implementation will support both shapes cleanly).

The frontend will call this directly (same pattern as `presign-upload` / `presign-download`). No auth header today — matches existing Worker endpoints. If you want auth on it later, that's a separate task.

---

## Changes

### 1. New helper: `src/lib/deleteScreeningVideoFromR2.ts`

Thin fetch wrapper:

```ts
const WORKER_URL = "https://api.rizonhire.com";

export async function deleteScreeningVideosFromR2(
  items: { bucket: string | null; key: string }[]
): Promise<void>
```

- Filters out items with no key.
- Defaults `bucket` to `"silverweb-ats-videos"` (matches `getSignedVideoViewUrl` behavior).
- Calls `/delete-object` per item (or batched if Worker supports `keys[]`).
- Swallows individual 404s (already-gone object) but throws on other errors so caller can show a toast.

### 2. `src/pages/screening/ScreeningSubmissions.tsx` — extend `handleDelete`

Currently deletes only the DB row. Change to:

1. Read `sub.video_bucket` and `sub.video_object_key` (fall back to `sub.video_url` for legacy rows, same as the review flow does).
2. Call `deleteScreeningVideosFromR2([...])` first.
3. Then `supabase.from("screening_submissions").delete().eq("id", sub.id)`.
4. On R2 failure: toast warning but still allow DB delete to proceed (orphaned R2 object is acceptable; orphan DB row that points to deleted video is worse). Show clear toast about partial success.

No UI changes — AlertDialog confirmation already exists.

### 3. `src/pages/screening/ScreeningJobs.tsx` — new "Delete job" action

- Add a `Trash2` icon button in the Actions column, **only rendered when `role === "admin"`** (read `role` from `useAuth()`, same pattern as `ScreeningSubmissions`).
- Wrap in `AlertDialog` with copy:
  > "Delete this screening job? This permanently removes the job, **all N video submissions**, their ratings, notes, and the video files from storage. This cannot be undone."
  - Show submission count (already in `job.submission_count`).
- On confirm:
  1. Fetch all submissions for the job: `select id, video_bucket, video_object_key, video_url where screening_job_id = job.id`.
  2. `deleteScreeningVideosFromR2(...)` for every submission with a key.
  3. `supabase.from("screening_submissions").delete().eq("screening_job_id", job.id)`.
  4. `supabase.from("screening_jobs").delete().eq("id", job.id)`.
  5. Toast success and `load()`.
- Disable the button while deletion is in flight (track `deletingJobId` state).

### 4. Worker (user-side, not in this repo)

You'll add `POST /delete-object` on the Worker. Suggested handler:

```js
// inside the Worker fetch handler
if (url.pathname === "/delete-object" && request.method === "POST") {
  const { bucket, key, keys } = await request.json();
  const r2 = env[bucket === "silverweb-ats-videos" ? "VIDEOS_BUCKET" : "RESUMES_BUCKET"];
  const targets = keys ?? [key];
  await Promise.all(targets.map((k) => r2.delete(k)));
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
```

Once deployed, the frontend changes above start working end-to-end.

---

## Verification

- As an admin: delete one submission → row gone from table, video gone from R2.
- As an admin: delete a screening job with N submissions → job gone, all N submission rows gone, all N R2 objects gone.
- As a non-admin: no delete buttons visible (matches existing pattern).
- Confirmation dialog must be clicked through in both flows.
