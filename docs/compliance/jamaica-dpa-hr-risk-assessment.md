# RizonHire (job-loom-light) — Jamaica DPA & HR Legal-Risk Assessment

**Prepared:** 2026-06-28
**Scope:** Codebase review of the RizonHire multi-tenant Applicant Tracking System against Jamaica's
**Data Protection Act, 2020 (DPA)** and Jamaican HR/employment law, with a phased remediation plan.
**Method:** Three independent reviews (two external tools + one codebase walkthrough) were consolidated and
**every disputed claim was re-verified against the source code.** Findings are labelled with their verification status.

> **Disclaimer — not legal advice.** This is an engineering/compliance gap analysis. The legal characterisations
> below (penalties, timeframes, registration duties) are summarised from public commentary on the DPA and should be
> confirmed by a Jamaican attorney and/or the Office of the Information Commissioner (OIC) before being relied upon.
> Specific figures (e.g. fine percentages, breach-notification windows) are flagged where the statute's exact wording
> should be checked.

---

## 1. Why this matters

RizonHire processes large volumes of **candidate personal data** — names, addresses, phone, email, education,
LinkedIn, résumés, **video interviews (image + voice)**, and free-text recruiter assessments. That makes each tenant
company a **data controller** and the platform operator a **data processor / joint controller** with direct statutory
obligations under the DPA.

The DPA is enforced by the OIC and (per public commentary — *confirm with counsel*) carries **monetary penalties**
(commentary cites up to 4% of annual gross worldwide turnover) and **criminal liability** for certain offences. Video
interviews are **sensitive personal data** (they can reveal racial/ethnic origin and are biometric/voice data), which
raises the bar on consent, security, and retention.

### Jamaica's eight Data Protection Standards (First Schedule) — mapping used in this report

| Std | Principle | Most-relevant findings |
|-----|-----------|------------------------|
| 1 | Fair & lawful processing | Consent quality (F4) |
| 2 | Specified/lawful purpose | Discrimination data (F8) |
| 3 | Adequate, relevant, not excessive (minimisation) | Video/free-text (F8) |
| 4 | Accurate & up to date | Data-subject correction (F3) |
| 5 | **Not kept longer than necessary (retention)** | Retention/purge (F6, F7) |
| 6 | Processed per data-subject rights | Access/erasure mechanism (F3) |
| 7 | **Appropriate technical & organisational security** | F1, F2, F5, F9, F10, F11 |
| 8 | **No transfer outside Jamaica without adequate protection** | Cross-border (F12) |

*(Note: numbering follows the Jamaican Act's First Schedule, which tracks the UK DPA 1998 order — retention is
Standard 5, security is Standard 7, cross-border transfer is Standard 8. One source report mislabeled these.)*

---

## 2. Consolidated risk register (verified, de-duplicated, ranked)

Verification key:
**✅ Confirmed** = reproduced in code · **⚠️ Latent** = real defect but live data path mitigates it ·
**🕓 Historical** = past exposure window, needs log review · **🔻 Corrected** = a source review overstated it ·
**🆕 New** = surfaced only during reconciliation.

| # | Finding | Severity | Status | DPA Std / Law | Evidence |
|---|---------|----------|--------|---------------|----------|
| F1 | **`send-candidate-email` is an unauthenticated email relay** — `verify_jwt=false`, CORS `*`, service-role send, attacker controls `to` + `variables` (injected into HTML unescaped). Can send as a tenant's verified domain → phishing/spam/blacklisting. | **Critical** | ✅ Confirmed | Std 7 | `supabase/config.toml`; `functions/send-candidate-email/index.ts` |
| F2 | **Cross-tenant access to screening videos in Supabase Storage** — `"Authenticated can view/delete screening videos"` policies are scoped only to `bucket_id`, no `company_id` filter; never dropped. Any authenticated user could read/delete any company's videos *in that bucket*. | **Critical** (if bucket used) | ⚠️ Latent | Std 7, sensitive data | `migrations/20260329145851…sql:105-109`; not dropped in `…20260503144026…sql` |
| F3 | **No data-subject-rights mechanism** — policy promises access/correction/erasure/withdrawal; no self-service flow, no contact, no SLA; deletion is admin-only and manual. | **High** | ✅ Confirmed | Std 6 | `defaultDataProtection.ts`; no request flow exists |
| F4 | **Consent is not recorded for job applications, and biometric consent is weak** — application checkbox stores nothing (`candidates` has no consent column); screening stores `privacy_consent=true` with no timestamp/version/biometric-specific wording. Sensitive data needs explicit, recorded consent. | **High** | ✅ Confirmed | Std 1, sensitive data | `PublicJobApplication.tsx:269,859`; `PublicScreening.tsx`; schema `…174810…sql` |
| F5 | **`screening-cleanup` runs destructive cross-tenant deletes with no caller authorization** — service-role, no cron-secret/role check; invocable by anyone holding the public anon key. | **High** | ✅ Confirmed | Std 7 | `functions/screening-cleanup/index.ts` |
| F6 | **The 60-day video purge does not actually delete R2 videos** — cleanup parses `video_url` as a Supabase Storage URL (`/screening-videos/`), but the column stores the **R2 object key**, so `new URL()` throws and `storage.remove()` targets the wrong/empty bucket. Biometric files accumulate indefinitely in R2. | **High** | 🆕 New | Std 5, sensitive data | `functions/screening-cleanup/index.ts:51-65` vs `uploadScreeningVideoToR2.ts` |
| F7 | **No retention policy/automated purge for candidates, résumés, notes, feedback** — kept "as long as needed"; only (broken) video cleanup exists. | **High** | ✅ Confirmed | Std 5 | no purge job; `defaultDataProtection.ts` |
| F8 | **Discrimination exposure from video + free-text + tags** — video reveals race/age/disability/pregnancy; `notes`, `interview_feedback`, arbitrary `candidate_tags`, guest feedback can capture protected characteristics; retained as discoverable evidence. | **High** | ✅ Confirmed | Std 2/3; Disabilities Act 2014; Charter | `notes`, `interview_feedback`, `candidate_tags`; `PublicFeedback.tsx` |
| F9 | **Stored XSS on public pages** — `job.description` rendered via `dangerouslySetInnerHTML` **without DOMPurify** on the public application & careers pages, which also collect applicant PII in the same DOM. | **Medium-High** | ✅ Confirmed | Std 7 | `PublicJobApplication.tsx:541`; `careers/JobDetailsPage.tsx:135` |
| F10 | **Historical public-bucket exposure** — `resumes` bucket public ~22 Mar→3 Apr (~12 days); `screening-videos` public ~29 Mar→3 May (~5 weeks), both with anon-read policies. Now fixed, but the window happened. | **Medium-High** | 🕓 Historical | Std 7; breach duty | `…225815…sql:43`; `…145851…sql:96`; lockdowns `…010105…`, `…144026…` |
| F11 | **No abuse protection / rate limiting on anon write paths** — `candidates`, `applications`, `candidate_files`, `screening_submissions`, and the R2 presign endpoint are open to enumeration/flooding. PII identifiers also logged to console in `uploadResumeToR2`. | **Medium** | ✅ Confirmed | Std 7 | anon RLS; `uploadResumeToR2.ts:22-28,43,53,65` |
| F12 | **Cross-border transfer undisclosed & unsafeguarded** — data sits on Supabase + Cloudflare R2 + Resend (outside Jamaica); not disclosed in the notice; no sub-processor list; no DPA between platform and tenants. | **High** | ✅ Confirmed | Std 8, Std 1 | upload libs; `send-candidate-email`; `defaultDataProtection.ts` |
| F13 | **Notice/transparency gaps** — privacy notice omits named processors, transfer, concrete retention periods, and the right to complain to the OIC; controller identity is generic ("this company"). | **Medium** | ✅ Confirmed | Std 1 | `defaultDataProtection.ts` |
| F14 | **OIC registration & DPO likely absent** — multi-tenant ATS with extensive processing of sensitive data ⇒ registration + designated Data Protection Officer expected. Organisational, not code. | **High** | ⚠️ Verify | DPA registration & DPO | n/a |
| F15 | **No breach-detection/response capability** — no audit log of who viewed candidate files/videos; no breach-notification runbook. | **Medium-High** | ✅ Confirmed | Std 7; breach duty | partial audit only; `docs/improvements.md` notes this |
| F16 | **Automated-decision watch-item** — `bulk-reject-applications` is fine *if* a human always clicks. Any future auto-scoring/auto-filtering would trigger automated-decision rights (human review). | **Low (now)** | ✅ Confirmed | Std 6 | `functions/bulk-reject-applications` |

---

## 3. Corrections to the source reviews (accuracy matters for a legal deliverable)

These claims appeared in the input reviews but **do not hold up** against the code, or need re-framing:

1. **🔻 "Committed `.env`/anon key is a Critical secret leak — rotate keys, purge git history."**
   `.env` is tracked and **not** git-ignored, but it contains **only** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`,
   and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is a `role: anon` JWT that is **public by design** (it
   also ships in the client bundle and is hardcoded in `externalClient.ts`). **No service-role key or provider secret
   is in the repo.** ⇒ This is a **hygiene** issue (add `.env` to `.gitignore`), **not** a breach; rotating the anon
   key buys no security. *The real consequence of a public anon key is that every anon-accessible surface is
   effectively internet-facing — which is exactly why F1 (open email relay) and F5 (unauthenticated cleanup) are the
   true risks.*

2. **🔻 "Wide-open CORS `*` on `create-company-admin` / `manage-company-user` is a High vulnerability."**
   Both functions **enforce auth server-side**: they read the `Authorization` header, call `auth.getUser()`, and verify
   `super_admin` (or company-`admin`) role before acting. CORS `*` on a **bearer-token-authenticated** endpoint is
   normal and not itself exploitable. ⇒ **Not a vulnerability.** The genuine CORS+auth problem is **F1**
   (`send-candidate-email`), which has CORS `*` **and** `verify_jwt=false` **and** no role check.

3. **Re-frame "screening videos are world-readable today."** The *policy* defect (F2) is real and confirmed, but the
   **live upload path stores videos in Cloudflare R2**, not Supabase Storage. So the cross-tenant exposure applies to
   whatever (if anything) sits in the Supabase `screening-videos` bucket — likely legacy/empty. ⇒ Fix the policy **and**
   verify the bucket is empty; treat as latent rather than actively exploited.

4. **Re-frame the breach-notification window.** Both external reviews cite a hard **"72 hours."** Jamaica's DPA
   requires notifying the Commissioner of a breach **without undue delay** (s.23); the precise "72 hours" is the GDPR
   figure. ⇒ Treat the duty as real and urgent, but **confirm the exact statutory window with counsel** rather than
   assuming 72h.

---

## 4. What is already done well (do not regress)

- **Strong multi-tenant RLS** on all core tables via `get_user_company_id()` (candidates, applications, notes, jobs,
  feedback, tags, screening rows).
- **RBAC** (`super_admin` / `admin` / `recruiter`) with security-definer `has_role()`.
- **Privilege-escalation bug already fixed** — the self-insert `user_roles` policy was dropped (`…144026…sql`).
- **Private R2 buckets + signed URLs**; the early public Supabase buckets were locked down; broken screening RLS check
  fixed; anon company enumeration replaced with a SECURITY DEFINER RPC.
- **DOMPurify already used** on the legal page (the pattern to copy for F9).
- **Versioned, customizable privacy policy** + consent checkboxes present on both intake forms.
- **No service-role/provider secrets in the repo; no AI auto-decisioning; no covert tracking or data sales found.**

---

## 5. Remediation plan (phased — execute after approval)

### Phase 0 — Verify the historical exposure (F10) — do first, in parallel
- Pull Supabase Storage + Cloudflare R2 access logs for **22 Mar–3 May 2026**; determine whether any résumé/video was
  fetched by an unexpected party while the buckets were public.
- Document the assessment in `docs/compliance/breach-assessment-2026.md`. If access is found, follow the breach runbook
  (Phase 4) and take legal advice on notifying the OIC and affected candidates.

### Phase 1 — Stop the bleeding (security) — F1, F2, F5, F9
- **F1:** set `verify_jwt = true` for `send-candidate-email`; verify the caller belongs to `company_id`; restrict `to`
  to a real candidate/application of that company; HTML-escape `variables`; lock CORS to known origins; add rate limit.
- **F2:** drop `"Authenticated can view/delete screening videos"` and replace with policies that join
  `screening_submissions`/`screening_jobs` to enforce `company_id = get_user_company_id(auth.uid())` (mirror the
  `candidate_files` pattern). Confirm the Supabase `screening-videos` bucket is empty.
- **F5:** gate `screening-cleanup` behind a shared `x-cron-secret` header known only to the scheduler.
- **F9:** wrap `job.description` renders in `DOMPurify.sanitize()` on `PublicJobApplication.tsx` and
  `careers/JobDetailsPage.tsx`; audit all `dangerouslySetInnerHTML` paths.
- **Hygiene:** add `.env`/`.env.*` to `.gitignore`; strip PII identifiers from `uploadResumeToR2` console logs.

### Phase 2 — Data-subject rights (F3)
- Email-verified self-service flow for **access/export, correction, erasure**, linked from the application
  confirmation and the privacy page.
- **Erasure** edge function cascading across `candidates`, `candidate_files`, `applications`, `notes`,
  `interview_feedback`, `screening_submissions` **and deleting the corresponding R2 objects**.
- **Export** function producing a JSON/PDF of everything held about the requester.
- Log every request + fulfilment to an audit table (for the OIC trail).

### Phase 3 — Retention & biometric consent (F4, F6, F7, F8)
- **Fix F6 first:** correct `screening-cleanup` to delete by R2 object key via the Worker (not Supabase Storage URL
  parsing); verify videos actually disappear.
- Per-company configurable **retention period** (default e.g. 12 months post-application) + scheduled purge for
  candidates/résumés/notes/feedback on closed/rejected applications, cascading to R2.
- Upgrade screening to **explicit, recorded biometric consent**: dedicated consent screen naming biometric/video
  processing, storing consent text + policy version + timestamp on `screening_submissions`.
- Persist **application consent** (given / timestamp / policy_version_id) on the candidate/application row.
- Guardrails on free-text/tags: recruiter/guest notice that protected-characteristic commentary is prohibited;
  restrict `candidate_tags` to an admin-approved library.

### Phase 4 — Policy, transfers, breach-readiness (F10, F12, F13, F15)
- Update the privacy notice to disclose **named sub-processors** (Supabase, Cloudflare R2, Resend), **cross-border
  transfer**, **concrete retention periods**, and the **right to complain to the OIC**; surface per-tenant controller
  identity.
- Put a **data-processing agreement** in place between the platform and each tenant company.
- Add **access-audit logging** on candidate file/video signed-URL issuance.
- Write `docs/compliance/breach-response.md` (detection → assess → notify-without-undue-delay → remediate) + a minimal
  admin alert hook.

### Phase 5 — Hardening (F11)
- Server-side file validation (magic-byte/MIME + size cap) in the presign Worker; rate-limit presign + public
  intake endpoints; CAPTCHA/Turnstile on public forms.

### Organisational (parallel, non-code) — F14, F16
- Register controller(s) with the **OIC**; designate a **Data Protection Officer**; have a Jamaican attorney review
  final policy/consent text. Keep `bulk-reject` human-in-the-loop; design future scoring for human review.

---

## 6. Verification / acceptance tests

- **F1:** `curl` the function with no/invalid JWT → 401; with a foreign `company_id` → 403; `Origin: https://evil.test`
  not reflected.
- **F2:** as Company B user, attempt to read/delete a Company A video object → denied; bucket confirmed empty.
- **F3:** submit access/export/erasure for a seeded candidate → DB rows **and** R2 objects gone after erasure; export
  bundle complete.
- **F5:** invoke `screening-cleanup` without the cron secret → rejected.
- **F6:** run cleanup against seeded >60-day jobs → R2 video objects actually removed.
- **F9:** seed a job description containing `<img onerror>`/`<script>` → rendered inert on public pages.
- **F4:** submit application + screening → consent text/version/timestamp persisted.
- **F12/F13:** load `/legal/data-protection` → processors, transfer, retention, OIC-complaint right present.
- Run the existing Vitest/Playwright + build pipeline → no regressions.

---

## 7. Priority summary (start here)

1. **F1** — close the open email relay.
2. **F2** — fix the cross-tenant video storage policy (+ confirm bucket empty).
3. **F5 / F6** — authenticate the cleanup job and make it actually delete R2 videos.
4. **F9** — DOMPurify the public job-description renders.
5. **F3 / F4 / F7** — data-subject rights, recorded consent, real retention.
6. **F12 / F14** — disclose transfers + DPAs; register with OIC and appoint a DPO (legal track).

Items F1, F2, F5, F6, F9 are small, high-payoff code changes. F3/F4/F7/F12 are larger but are where the DPA's
sharpest obligations bite. F14 and the attorney sign-off are organisational and should run from day one.
