# Plan: Reliable, queued application-confirmation emails (Supabase Queues / pgmq)

## Context

When a candidate submits an application, the confirmation email frequently never sends. Two
root problems:

1. **The trigger is fire-and-forget with errors swallowed.** In
   [`src/pages/apply/PublicJobApplication.tsx:459-467`](src/pages/apply/PublicJobApplication.tsx)
   the call is `supabase.functions.invoke("send-candidate-email", …).catch(err => console.error(...))`.
   The applicant sees "success" even when the email call 403/500s, and nobody is alerted.
   Likely concrete failure causes (browser path): the edge function's **CORS allowlist**
   (`DEFAULT_ALLOWED_ORIGINS` = only `app.rizonhire.com` + localhost in
   [`send-candidate-email/index.ts:37-41`](supabase/functions/send-candidate-email/index.ts)) — if
   applicants apply from any other origin it returns 403 — and/or a missing `RESEND_API_KEY` /
   missing active `application_received` template row. (Note: the earlier theory that
   `verify_jwt = true` always 401s is *wrong* — `.env` uses a legacy anon JWT key, which passes.)

2. **No burst protection.** 100 applications in a few minutes would fire 100 simultaneous
   Resend calls, exceeding Resend's default ~2 req/s limit and causing drops, with no retry.

**Goal:** every applicant reliably gets their confirmation email, with submission spikes
absorbed and smoothed, and failures retried + observable — using only free, in-stack tooling.

**Chosen approach (user-selected):** Supabase Queues (**pgmq**) + a `pg_cron` drainer +
the existing Resend sender. No new vendor/account/secret. Reuses the existing
`pg_cron` + `pg_net` + `x-cron-secret` pattern already used for billing
([`docs/02-technical.md:206-224`](docs/02-technical.md),
[`docs/billing-stage-f-migration.sql:59-88`](docs/billing-stage-f-migration.sql)).
Emails do **not** go through Cloudflare — the CF Worker (`api.rizonhire.com`) only proxies R2 —
so the queue belongs in Supabase next to the email logic, DB, templates and send-log.

> Why not Upstash/Cloudflare: Upstash **QStash** (not Upstash Redis) would work but adds a
> vendor + token + signature verification while still just calling the Supabase function.
> Cloudflare Queues is now free but the consumer would still need Resend + Supabase access that
> lives in Supabase today. Both add cross-platform moving parts for no benefit here.

## Architecture

```
applications INSERT
      │ (AFTER INSERT trigger, atomic)
      ▼
pgmq queue: application_emails        ← burst absorbed instantly
      │
      │  pg_cron every 1 min  ──►  net.http_post(process-email-queue, x-cron-secret)
      ▼
process-email-queue edge fn (verify_jwt=false, x-cron-secret gated)
      │  pgmq.read(batch, vt) → send (rate-limited) → pgmq.delete on success
      │  on failure: leave for retry; archive to DLQ after N attempts
      ▼
shared sender → Resend  +  email_send_log (existing dedup keeps it exactly-once)
```

The DB trigger removes the browser from the email path entirely — eliminating the
CORS/origin/JWT-from-browser failure modes and the silent `.catch`.

## Changes

### 1. DB migration — `supabase/migrations/<timestamp>_application_email_queue.sql` (NEW)
- Enable extensions if not already: `pgmq` (+ confirm `pg_cron`, `pg_net` enabled).
- Create queue: `select pgmq.create('application_emails');`
- `AFTER INSERT ON public.applications` trigger function (`SECURITY DEFINER`,
  `SET search_path = public, pgmq`) that enqueues:
  `pgmq.send('application_emails', jsonb_build_object('application_id', NEW.id::text, 'mode','application_received'))`.
  Exactly one message per application, in the same transaction as the insert.

### 2. Shared sender — `supabase/functions/_shared/email-application.ts` (NEW)
- Extract the pure logic from
  [`send-candidate-email/index.ts:160-276`](supabase/functions/send-candidate-email/index.ts)
  (`getTemplate`, `resolveSender`, `render`/escape helpers, the application-received fetch to
  Resend, and the `email_send_log` insert + existing duplicate check at lines 226-235) into a
  reusable function `sendApplicationReceived(admin, applicationId)` that takes an admin client and
  returns a result object (no `Request`/CORS coupling).
- This keeps the existing **dedup** (`email_send_log` "sent" check) so reprocessing a message
  never double-sends.

### 3. Drainer — `supabase/functions/process-email-queue/index.ts` (NEW)
- Gate on `x-cron-secret` header (mirror
  [`screening-cleanup`](supabase/functions/send-candidate-email/index.ts) auth style); no CORS/JWT.
- Loop within the 150s function budget: `pgmq.read('application_emails', vt:=60, qty:=BATCH)`
  via the service-role client (`admin.rpc('read', …)` in the `pgmq` schema, or `admin.schema('pgmq')`),
  then for each message call `sendApplicationReceived(admin, msg.message.application_id)`.
  - success → `pgmq.delete('application_emails', msg.msg_id)`
  - failure → leave it (re-appears after `vt` for retry); if `msg.read_ct >= MAX_ATTEMPTS`
    → `pgmq.archive('application_emails', msg.msg_id)` (DLQ) and log the reason.
- **Rate limit:** send sequentially with small spacing (e.g. ~150ms) and/or cap `BATCH` so
  throughput stays under Resend's ~2 req/s (120/min). Make `BATCH`, `MAX_ATTEMPTS`, spacing
  configurable via env. Stop the loop when the queue returns empty or time budget is near.

### 4. `supabase/config.toml` (MODIFY)
- Add:
  ```toml
  [functions.process-email-queue]
  verify_jwt = false
  ```

### 5. `send-candidate-email/index.ts` (MODIFY)
- Replace its inline application-received logic with a call into the new shared module
  (keep the `test` mode + super-admin auth + CORS exactly as-is). Keeps a single source of truth.

### 6. `src/pages/apply/PublicJobApplication.tsx` (MODIFY)
- Remove the fire-and-forget `supabase.functions.invoke("send-candidate-email", …)` block at
  lines 459-467 — enqueue now happens server-side via the DB trigger. (Application submission
  flow is otherwise unchanged.)

### 7. Ops / deploy (run against the live external Supabase project)
- Confirm the **correct project ref**: `config.toml` says `xkyuybfxdxxzzfdjftss`, but
  `docs/02-technical.md` references `jfiyvvigvknfemqfnucl`. Verify which is live before scheduling.
- Verify secrets exist: `RESEND_API_KEY`, `CRON_SECRET` (+ `RIZONHIRE_FROM_EMAIL`, `ALLOWED_ORIGINS`).
- Confirm an **active** `application_received` row exists in `email_templates`, and that
  `email_templates` + `email_send_log` tables exist (per `docs/billing-stage-g-email-migration.sql`).
- Deploy functions: `supabase functions deploy process-email-queue` and re-deploy
  `send-candidate-email`.
- Schedule the drainer (mirror existing billing cron):
  ```sql
  select cron.schedule('process-application-emails', '* * * * *', $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
      body := '{}'::jsonb
    );
  $$);
  ```

## Verification

1. **Enqueue:** Insert one test application → confirm a message lands in the queue
   (`select * from pgmq.metrics('application_emails');` shows `queue_length = 1`).
2. **Drain (manual):** `curl -H "x-cron-secret: <CRON_SECRET>"` the `process-email-queue` URL →
   confirm a real email arrives, `email_send_log` has a `sent` row, queue length returns to 0.
3. **Dedup:** Re-invoke the drainer for the same application → no second email (existing
   `email_send_log` "sent" check), message removed.
4. **Burst:** Insert ~100 applications quickly → queue depth spikes, then drains over the next
   minute or two with all `email_send_log` rows `sent`, no duplicates, no Resend rate-limit errors.
5. **Failure/DLQ:** Force a failure (disabled template or invalid recipient) → message retries
   then moves to the pgmq archive after `MAX_ATTEMPTS`; no infinite loop, reason logged.
6. **Regression:** existing Playwright application-submit test (`tests/`) still passes; the
   submit UX is unchanged (success screen no longer depends on the email call).
