

# Fix R2 Video Screening Integration

## Problem

The R2 upload flow is already wired up but has a bug that will cause submissions to fail: **line 264 of `PublicScreening.tsx`** inserts `bucket_type: r2Result.bucketType` into `screening_submissions`, but that table has **no `bucket_type` column**. This will throw a database error on every submission.

Additionally, the `VITE_UPLOAD_BACKEND_URL` environment variable needs to be set so both the upload and download flows use your Render backend consistently.

## Changes

### 1. Fix `screening_submissions` insert in `PublicScreening.tsx`
- Remove the `bucket_type` field from the insert on line 264 — the table doesn't have this column
- The R2 key stored in `video_url` is sufficient; bucket info is already tracked in `candidate_files`

### 2. Set `VITE_UPLOAD_BACKEND_URL` environment variable
- Value: `https://job-loom-light-backend.onrender.com`
- This is used by both `PublicScreening.tsx` (upload) and `videoUrl.ts` (download/playback)
- Currently the upload side has a hardcoded fallback but `videoUrl.ts` will throw if the env var is missing

### 3. Verify `videoUrl.ts` response field
- Currently expects `data.downloadUrl` from your Render `/api/download-url` endpoint
- Confirm your backend returns `{ downloadUrl: "..." }` — if it returns a different field name (e.g. `url`), we'll update accordingly

## Files Modified
- `src/pages/screening/PublicScreening.tsx` — remove `bucket_type` from insert
- Environment config — add `VITE_UPLOAD_BACKEND_URL`

## Render Backend Requirements
Your backend needs these two endpoints working:
1. **`POST /api/upload-url`** — accepts `{ fileName, fileType, companyId, jobId, candidateId, bucketType }`, returns `{ uploadUrl, key, bucket, bucketType }`
2. **`POST /api/download-url`** — accepts `{ key, bucketType }`, returns `{ downloadUrl }`

