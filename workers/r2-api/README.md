# RizonHire R2 API Worker

Cloudflare Worker for RizonHire file upload, signed view links, invoice PDFs, governed exports, and storage cleanup.

## Buckets

- `silverweb-ats-resumes`: resume/CV uploads only
- `silverweb-ats-videos`: screening videos only
- `silverweb-additional-documents`: candidate documents, public application extra documents, and lead form/TRN uploads
- `rizonhire-invoices`: generated invoice PDFs
- `rizonhire-exports`: governed async `.xlsx` exports only

## Secrets

Do not commit `.dev.vars`. The archived Worker ZIP exposed old-looking secrets, so rotate these before deploying:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_EXPORTS_BUCKET` (configured as a Worker var in `wrangler.jsonc`)
- `RESEND_API_KEY`
- `R2_WORKER_SECRET`

## Required Cloudflare Setup

Create the new R2 bucket:

```bash
npx wrangler r2 bucket create silverweb-additional-documents
npx wrangler r2 bucket create rizonhire-exports
```

Apply `r2-cors-additional-documents.json` to `silverweb-additional-documents` in Cloudflare R2 CORS settings. The same browser upload CORS shape should also be present on `silverweb-ats-resumes` and `silverweb-ats-videos`.

Do not add browser CORS rules or public access to `rizonhire-exports`. Export files are uploaded, signed, and deleted only through Worker-secret routes called by Supabase Edge Functions.

Deploy:

```bash
npm install
npm run test
npm run deploy
```
