import { test, expect, type Page } from "@playwright/test";
import { env, selectOption, readHandoff } from "./helpers";
import { buildDemoScenario, createResumePdf, scenarioFromHandoff, type DemoScenario } from "./demoData";

const fallbackScenario = buildDemoScenario(env.demoSeed);

/**
 * CANDIDATE JOURNEY  (matches the "Job applicant" map)
 *
 *   01 Discover            05 Video screening
 *   02 Explore the role    06 Wait for word        (email-gated — see note)
 *   03 Apply               07 Outcome              (email-gated — see note)
 *   04 Confirmation
 *
 * Runs against public routes (no login). The video step needs the fake
 * camera/mic configured in the "candidate" project of playwright.config.e2e.ts.
 *
 * Stages 06–07 are driven by send-candidate-email and have no in-app surface
 * for the applicant (there's no candidate login in the route map), so they
 * can't be asserted end-to-end without a test mailbox. They're marked fixme
 * with a wired-up example rather than faked.
 */

function currentHandoff() {
  return readHandoff();
}

function currentCompanySlug() {
  const handoff = currentHandoff();
  return env.companySlug || (typeof handoff.companySlug === "string" ? handoff.companySlug : "");
}

function currentScenario() {
  return scenarioFromHandoff(currentHandoff()) ?? fallbackScenario;
}

function normalizeApplyPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  const uuid = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (uuid) return `/apply/${uuid}`;

  try {
    const path = new URL(decoded, "https://example.test").pathname;
    const parts = path.split("/").filter(Boolean);
    const applyIndex = parts.lastIndexOf("apply");
    if (applyIndex >= 0 && parts[applyIndex + 1]) {
      return `/apply/${parts[applyIndex + 1]}`;
    }
  } catch {
    // Fall through to the simple ID/path handling below.
  }

  if (decoded.startsWith("/apply/")) return decoded;
  if (/^[\w-]+$/.test(decoded)) return `/apply/${decoded}`;
  return decoded;
}

async function waitForCareersPageLoaded(page: Page) {
  await expect(page.locator("header .animate-pulse, main .animate-pulse")).toHaveCount(0, {
    timeout: 15_000,
  });

  await expect(page.getByRole("heading").first()).toBeVisible();
}

async function openCareersPage(page: Page, companySlug: string) {
  await page.goto(`/${companySlug}/careers`);
  await expect(page).toHaveURL(new RegExp(`/${companySlug}/careers`));
  await waitForCareersPageLoaded(page);
}

test.describe.configure({ mode: "serial" });

test.describe("Candidate journey", () => {
  // Shared across steps in this serial file.
  let jobApplyUrl = env.jobId ? normalizeApplyPath(env.jobId) : "";
  let scenario: DemoScenario = currentScenario();

  // ---- 01 · Discover ----------------------------------------------------
  test("01 · browses open roles on the careers page", async ({ page }) => {
    const companySlug = currentCompanySlug();
    scenario = currentScenario();
    test.skip(!companySlug, "Set E2E_COMPANY_SLUG (or run the HR journey first).");

    await openCareersPage(page, companySlug);
  });

  // ---- 02 · Explore the role -------------------------------------------
  test("02 · opens a job and finds the apply call-to-action", async ({
    page,
  }) => {
    const companySlug = currentCompanySlug();
    scenario = currentScenario();
    test.skip(!companySlug, "Set E2E_COMPANY_SLUG (or run the HR journey first).");

    await openCareersPage(page, companySlug);

    const expectedJobLink = page.locator('a[href*="/careers/"]').filter({ hasText: scenario.job.title }).first();
    const jobLink = (await expectedJobLink.count()) ? expectedJobLink : page.locator('a[href*="/careers/"]').first();
    test.skip(
      (await jobLink.count()) === 0,
      "No published jobs on this careers page — publish one (HR step 03).",
    );

    await jobLink.click();
    await expect(page).toHaveURL(/\/careers\/[\w-]+/);
    await expect(page.getByRole("heading", { name: /interested in this role/i })).toBeVisible();
    const applyCta = page.getByRole("button", { name: /^apply now$/i });
    await expect(applyCta).toBeVisible();
    if (scenarioFromHandoff(currentHandoff())) {
      await expect(page.getByRole("heading", { name: scenario.job.title })).toBeVisible();
    }

    // Capture the apply URL for the next step.
    await applyCta.click();
    await expect(page).toHaveURL(/\/apply\/[\w-]+/);
    jobApplyUrl = normalizeApplyPath(page.url());
  });

  // ---- 03 · Apply -------------------------------------------------------
  test("03 · completes and submits an application", async ({ page }) => {
    scenario = currentScenario();
    test.skip(!jobApplyUrl, "No apply URL resolved from step 02.");
    await page.goto(jobApplyUrl);

    await page.getByTestId("applicant-full-name").fill(scenario.candidate.fullName);
    await page.getByTestId("applicant-email").fill(scenario.candidate.email);
    await page.getByTestId("applicant-phone").fill(scenario.candidate.phone);

    // Country → Parish are dependent Radix selects (PARISHES_BY_COUNTRY).
    await selectOption(page, page.getByTestId("applicant-country-trigger"), scenario.candidate.country);
    await page.getByTestId("applicant-street-address").fill(scenario.candidate.streetAddress);
    await selectOption(page, page.getByTestId("applicant-parish-state-trigger"), scenario.candidate.parishState);

    await selectOption(page, page.getByTestId("applicant-education-level-trigger"), scenario.candidate.educationLevel);

    // Resume is required. The generated PDF is synthetic but valid and readable.
    await page.getByTestId("applicant-resume-upload").setInputFiles({
      name: scenario.candidate.resumeFileName,
      mimeType: "application/pdf",
      buffer: createResumePdf(scenario),
    });

    // Optional LinkedIn — validated against linkedin.com if present.
    const linkedin = page.getByTestId("applicant-linkedin").first();
    if (await linkedin.count())
      await linkedin.fill(scenario.candidate.linkedinUrl);

    // Required: agree to the Data Protection Agreement.
    await page.getByTestId("applicant-consent-checkbox").check();

    await page
      .getByRole("button", { name: /apply|submit|send application/i })
      .first()
      .click();

    // ---- 04 · Confirmation ----------------------------------------------
    // Success screen (PublicJobApplication renders a CheckCircle confirmation).
    await expect(
      page.getByText(/thank you|received|submitted|success|application/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ---- 05 · Video screening --------------------------------------------
  test("05 · records and submits the one-way video screening", async ({
    page,
  }) => {
    scenario = currentScenario();
    const handoff = currentHandoff();
    const linkId = env.screeningLinkId || (typeof handoff.screeningLinkId === "string" ? handoff.screeningLinkId : "");
    test.skip(
      !linkId,
      "Set E2E_SCREENING_LINK_ID (or run HR step 04 to generate one).",
    );

    await page.goto(`/screen/${linkId}`);
    // Guard against expired/removed links (PublicScreening shows these states).
    await expect(
      page.getByText(/screening not found|expired/i),
    ).toHaveCount(0);

    await page.getByPlaceholder(/john doe/i).fill(scenario.candidate.fullName);
    await page.getByPlaceholder(/john@example\.com/i).fill(scenario.candidate.email);

    // Consent: "I consent to my video being recorded..."
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Fake media is provided by the project launch args. Drive the recorder.
    await page.getByRole("button", { name: /i'm ready/i }).click();
    await expect(page.getByText(scenario.screening.question)).toBeVisible();
    const stop = page.getByRole("button", { name: /stop recording/i }).first();
    await expect(stop).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000); // capture a short clip from the fake stream
    await stop.click();

    await page
      .getByRole("button", { name: /submit|upload|finish|send/i })
      .first()
      .click();

    // Success copy from PublicScreening.tsx
    await expect(
      page.getByText(/submitted|video has been submitted/i),
    ).toBeVisible({ timeout: 30_000 });
  });

  // ---- 06 · Wait for word ----------------------------------------------
  test.fixme(
    "06 · receives status emails (needs a test mailbox)",
    async ({ page }) => {
      // There is no candidate login, so the only signal is email from
      // send-candidate-email. To automate this, point the app's email provider
      // at a test inbox (e.g. Mailosaur / Mailpit) and assert delivery:
      //
      //   const email = await mailbox.getMessage(inboxId, { sentTo: candidate });
      //   expect(email.subject).toMatch(/application|update|status/i);
      //
      // Until that's wired, this is intentionally pending rather than faked.
    },
  );

  // ---- 07 · Outcome -----------------------------------------------------
  test.fixme(
    "07 · receives offer or rejection (needs a test mailbox)",
    async ({ page }) => {
      // Same constraint as step 06. Assert the offer/rejection template lands
      // in the test inbox once a mailbox is configured.
    },
  );
});
