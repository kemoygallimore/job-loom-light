# RizonHire — Journey E2E Tests (Playwright)

Two Playwright specs that walk each step of the journey maps:

- `tests/e2e/hr-admin-journey.spec.ts` — the recruiter / company-admin map
- `tests/e2e/candidate-journey.spec.ts` — the job-applicant map

Each `test()` is named after a stage on the map, so the Playwright HTML report
reads top-to-bottom like the journey itself.

## Install

```bash
npm i -D @playwright/test dotenv
npx playwright install chromium
```

## Configure

```bash
cp .env.e2e.example .env.e2e   # then fill it in
```

Use a **test** Supabase project, never production — the HR suite creates jobs
and rejects candidates, and the candidate suite uploads a résumé and a video.

## Demo data

The journey specs use `tests/e2e/demoData.ts` to generate realistic synthetic
records for client demos. Each HR run creates a fresh Jamaica/Caribbean-flavored
scenario: a corporate role, rich job description, hiring manager, screening
question, candidate profile, LinkedIn URL, and a readable PDF résumé. No
external data API is used.

Optional environment controls:

```bash
E2E_DEMO_SEED=demo-2026-06-kingston   # repeat the same scenario
E2E_DEMO_EMAIL_DOMAIN=example.com      # use a test inbox domain for email demos
E2E_DEMO_EMAIL_PREFIX=candidate
```

Leave `E2E_DEMO_SEED` blank when you want a new but realistic scenario each run.
The HR journey writes the generated scenario into `.artifacts/handoff.json`; the
candidate journey reads it at runtime so applications and screenings match the
same role.

## Run

```bash
# everything (setup → HR → candidate)
npx playwright test --config=playwright.config.e2e.ts

# one persona
npx playwright test --config=playwright.config.e2e.ts --project=hr-admin
npx playwright test --config=playwright.config.e2e.ts --project=candidate

# watch it happen
npx playwright test --config=playwright.config.e2e.ts --headed
npx playwright show-report
```

The `setup` project logs the HR admin in once and saves the session to
`tests/e2e/.auth/`. The HR run also writes a fresh job title + screening link to
`.artifacts/handoff.json`, which the candidate run picks up — so you don't have
to hardcode IDs. Keep both `.artifacts/` and `tests/e2e/.auth/` out of commits.

## Stage → test mapping

| Journey stage (HR admin)   | Test                                     |
|----------------------------|------------------------------------------|
| Account provisioned        | `01 · lands in the app…`                 |
| Set up team & brand        | `02 · can reach team management`         |
| Post a job                 | `03 · creates a job…`                    |
| Build screening            | `04 · creates a video screening…`        |
| Review applicants          | `05 · reviews candidate profiles…`       |
| Run the pipeline           | `06 · moves a candidate…`                |
| Communicate decisions      | `07 · bulk-rejects selected candidates`  |
| Billing & ongoing          | `08 · views billing and an invoice`      |

| Journey stage (Candidate)  | Test                                     |
|----------------------------|------------------------------------------|
| Discover                   | `01 · browses open roles…`               |
| Explore the role           | `02 · opens a job…`                      |
| Apply                      | `03 · completes and submits…`            |
| Confirmation               | (asserted at the end of `03`)            |
| Video screening            | `05 · records and submits…`              |
| Wait for word              | `06 · receives status emails` (fixme)    |
| Outcome                    | `07 · receives offer/rejection` (fixme)  |

## Three steps that can't be faked green

These are marked in the code so the report tells the truth rather than passing
on a stub:

1. **Email-gated stages (candidate 06–07).** There's no candidate login in the
   route map, so the applicant's only signal is `send-candidate-email`. To
   automate, point the email provider at a test inbox (Mailosaur / Mailpit) and
   assert delivery — the `test.fixme` blocks show where. The HR side captures
   stage movement in the app; it does not fake email delivery.
2. **Video capture (candidate 05).** Driven with Chromium's fake camera/mic
   (`--use-fake-*-for-media-stream` in the config). The test grants consent,
   records a short clip, and submits. If your recorder controls differ, adjust
   the button names in the step.
3. **Domain verification (HR 02).** `manage-company-domain` ends in a real DNS
   step; the test only asserts the UI is reachable.

## Selectors — a note

The application form already exposes several `data-testid` hooks, so the
candidate journey uses those for the demo-critical fields. The HR journey still
leans on roles, visible text, and scoped row selectors where the app does not
yet expose stable IDs. Adding the IDs in `SUGGESTED_TESTIDS` (see `helpers.ts`)
will make the suite more stable over time.

## Seed data

Steps that need existing records (review applicants, move on the pipeline,
bulk reject, open an invoice) `test.skip` themselves with a clear message when
nothing is seeded, so a fresh project won't throw false failures. Seed one
end-to-end application (run the candidate journey first, or insert fixtures) to
light those up.
