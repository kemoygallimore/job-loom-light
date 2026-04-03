

# Integrate Render Backend for R2 Video Uploads

## Overview

Replace the current Supabase Storage upload in the screening flow with Cloudflare R2 uploads via your Render backend. The `uploadToR2` utility already exists — we just need to wire it into the `submitVideo` function and configure the backend URL.

## Steps

### 1. Add `VITE_BACKEND_BASE_URL` environment variable
- Store your Render backend URL (e.g. `https://your-api.onrender.com`) as a public env var in the codebase since it's not a secret.

### 2. Update `submitVideo` in `PublicScreening.tsx`
- Replace the Supabase Storage upload (lines 166-175) with the `uploadToR2` utility
- Convert the `videoBlob` to a `File` object (required by `uploadToR2`)
- Use the returned R2 `key` as the `video_url` stored in `screening_submissions` (instead of a public Supabase URL)
- Also insert a record into `candidate_files` table for tracking
- The flow becomes:
  1. Request presigned URL from Render backend
  2. PUT video directly to R2
  3. Save R2 key in `screening_submissions.video_url` and `candidate_files`

### 3. Update video playback in `ScreeningSubmissions.tsx`
- Since videos are now in R2 (not Supabase Storage), the `video_url` field will contain an R2 key rather than a public URL
- Need to add a mechanism to generate viewable URLs — either:
  - A Render endpoint like `/api/download-url` that returns signed read URLs
  - Or store the full CDN URL if your R2 bucket has a public custom domain

### 4. Secure the `screening-videos` Supabase bucket
- Since videos will now go to R2, the existing `screening-videos` bucket can be made private or removed. Existing videos already uploaded there will need consideration.

## Technical Details

**File changes:**
- `src/pages/screening/PublicScreening.tsx` — replace `supabase.storage` upload with `uploadToR2`
- `src/pages/screening/ScreeningSubmissions.tsx` — update video URL resolution for R2-stored videos
- Possibly add a small utility for generating R2 read URLs via your Render backend

**Key consideration:** Your Render backend needs two endpoints:
1. `POST /api/upload-url` — generates presigned PUT URL (for uploads)
2. `GET /api/download-url` or similar — generates presigned GET URL (for playback in the recruiter dashboard)

If your R2 bucket has a public domain or CDN, the download endpoint may not be needed.

