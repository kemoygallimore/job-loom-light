# RizonHire R2 API Worker

Cloudflare Worker for RizonHire file upload, signed view links, invoice PDFs, and storage cleanup.

## Buckets

- `silverweb-ats-resumes`: resume/CV uploads only
- `silverweb-ats-videos`: screening videos only
- `silverweb-additional-documents`: candidate documents, public application extra documents, and lead form/TRN uploads
- `rizonhire-invoices`: generated invoice PDFs

## Secrets

Do not commit `.dev.vars`. The archived Worker ZIP exposed old-looking secrets, so rotate these before deploying:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `RESEND_API_KEY`
- `R2_WORKER_SECRET`

## Required Cloudflare Setup

Create the new R2 bucket:

```bash
npx wrangler r2 bucket create silverweb-additional-documents
```

Apply `r2-cors-additional-documents.json` to `silverweb-additional-documents` in Cloudflare R2 CORS settings. The same browser upload CORS shape should also be present on `silverweb-ats-resumes` and `silverweb-ats-videos`.

Deploy:

```bash
npm install
npm run test
npm run deploy
```
