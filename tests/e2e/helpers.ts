import { type Page, type Locator, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ *
 * Environment
 * ------------------------------------------------------------------ */

export const env = {
  baseUrl: process.env.E2E_BASE_URL ?? "http://localhost:8080",

  // HR admin login (seed this account in your test project).
  // Read lazily — blank is fine until an HR stage actually logs in.
  hrEmail: process.env.E2E_HR_EMAIL ?? "",
  hrPassword: process.env.E2E_HR_PASSWORD ?? "",

  // Public careers context the candidate journey walks through.
  // companySlug is used to open /:companySlug/careers.
  companySlug: process.env.E2E_COMPANY_SLUG ?? "",

  // Optional: a known published jobId / screening linkId. If omitted, the
  // candidate spec discovers them from the careers page / the HR handoff file.
  jobId: process.env.E2E_JOB_ID ?? "",
  screeningLinkId: process.env.E2E_SCREENING_LINK_ID ?? "",

  // Optional demo-data controls. Leave blank for a fresh realistic scenario
  // on each HR run; set a seed when you need reproducible demo records.
  demoSeed: process.env.E2E_DEMO_SEED ?? "",
  demoEmailDomain: process.env.E2E_DEMO_EMAIL_DOMAIN ?? "example.com",
  demoEmailPrefix: process.env.E2E_DEMO_EMAIL_PREFIX ?? "candidate",
};

/* ------------------------------------------------------------------ *
 * Cross-spec handoff
 * The HR journey can create a job + screening link and write them here so the
 * candidate journey can pick them up without hardcoded IDs.
 * ------------------------------------------------------------------ */

const HANDOFF = path.join(process.cwd(), ".artifacts", "handoff.json");

export function writeHandoff(data: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(HANDOFF), { recursive: true });
  const existing = readHandoff();
  fs.writeFileSync(HANDOFF, JSON.stringify({ ...existing, ...data }, null, 2));
}

export function readHandoff(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(HANDOFF, "utf8"));
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export async function loginAsHr(page: Page) {
  if (!env.hrEmail || !env.hrPassword) {
    throw new Error(
      "This stage needs a login. Add E2E_HR_EMAIL and E2E_HR_PASSWORD to .env.e2e, then rerun.",
    );
  }
  await page.goto("/auth");
  await page.locator("#email").fill(env.hrEmail);
  await page.locator("#password").fill(env.hrPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Land on an authenticated route (dashboard is the default home).
  await page.waitForURL(/\/(dashboard|jobs|candidates|pipeline|admin)/, {
    timeout: 15_000,
  });
}

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

/** A unique-ish suffix so re-runs don't collide on names. */
export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/** Fill a shadcn/Radix <Select> by visible trigger text + option text. */
export async function selectOption(
  page: Page,
  triggerLabelOrLocator: string | RegExp | Locator,
  optionText: string | RegExp,
) {
  const trigger =
    typeof triggerLabelOrLocator === "string" || triggerLabelOrLocator instanceof RegExp
      ? page.getByRole("combobox", { name: triggerLabelOrLocator })
      : triggerLabelOrLocator;
  await trigger.click();
  await page.getByRole("option", { name: optionText }).click();
}

/**
 * Move a candidate card to a stage on the pipeline board.
 *
 * The board uses @hello-pangea/dnd; native drag is flaky in Playwright. The
 * app exposes stage changes in the candidate side panel, so this helper opens
 * the card and uses that existing Select instead of trying to drag.
 */
export async function moveCandidateToStage(
  page: Page,
  candidateOrCard: string | Locator,
  stageLabel: string | RegExp,
) {
  const candidateName =
    typeof candidateOrCard === "string" ? candidateOrCard.trim() : "";
  const card =
    typeof candidateOrCard === "string"
      ? page
          .locator('[data-testid^="pipeline-card"], .pipeline-card')
          .filter({ hasText: candidateName })
          .first()
      : candidateOrCard;
  await expect(card, `pipeline card for "${candidateName}"`).toBeVisible();

  await card.click();

  const panel = page.locator("div.fixed.inset-y-0.right-0.z-50").last();
  await expect(panel, "candidate detail panel").toBeVisible();

  const stageSelect = panel.getByRole("combobox").first();
  await expect(stageSelect, "candidate panel stage select").toBeVisible();
  await selectOption(page, stageSelect, stageLabel);
}

/* ------------------------------------------------------------------ *
 * Suggested data-testids
 * Your app currently has ~1 testid. Adding these makes the suite far more
 * stable than text/role guessing. Each maps to a journey-map touchpoint.
 * ------------------------------------------------------------------ */

export const SUGGESTED_TESTIDS = {
  // HR
  jobsCreateButton: "jobs-create",
  jobsTitleInput: "job-title-input",
  jobsSubmit: "job-submit",
  screeningCreateButton: "screening-create",
  screeningCopyLink: "screening-copy-link",
  pipelineCard: "pipeline-card",
  pipelineCardStage: "pipeline-card-stage",
  bulkRejectButton: "bulk-reject",
  teamInviteButton: "team-invite",
  // Candidate
  applySubmit: "apply-submit",
  applyConsent: "apply-consent",
  screeningRecord: "screening-record",
  screeningSubmit: "screening-submit",
} as const;
