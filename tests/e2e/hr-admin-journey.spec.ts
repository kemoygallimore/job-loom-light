import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  env,
  moveCandidateToStage,
  writeHandoff,
} from "./helpers";
import { buildDemoScenario } from "./demoData";

const scenario = buildDemoScenario(env.demoSeed);

function pipelineStage(page: Page, stageName: string | RegExp) {
  return page
    .locator(".kanban-column")
    .filter({ has: page.getByRole("heading", { name: stageName }) })
    .first();
}

async function pipelineCardName(card: Locator) {
  const name = (await card.locator(".font-medium").first().textContent())?.trim() ?? "";
  expect(name, "pipeline card has a visible candidate name").not.toBe("");
  return name;
}

async function fillRichTextEditor(editor: Locator, html: string, plainText: string) {
  await expect(editor).toBeVisible();
  await editor.evaluate(
    (element, value) => {
      type QuillBridge = {
        setText: (text: string) => void;
        blur: () => void;
        clipboard?: {
          dangerouslyPasteHTML: (html: string) => void;
        };
      };
      const container = element.closest(".ql-container") as HTMLElement | null;
      const quill = container && (container as unknown as { __quill?: QuillBridge }).__quill;
      if (quill?.clipboard?.dangerouslyPasteHTML) {
        quill.setText("");
        quill.clipboard.dangerouslyPasteHTML(value.html);
        quill.blur();
        return;
      }

      element.textContent = value.plainText;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value.plainText }));
    },
    { html, plainText },
  );
}

/**
 * HR ADMIN JOURNEY  (matches the "Recruiter / company admin" map)
 *
 *   01 Account provisioned     06 Run the pipeline
 *   02 Set up team & brand      07 Communicate decisions
 *   03 Post a job               08 Billing & ongoing
 *   04 Build screening
 *   05 Review applicants
 *
 * Runs authenticated via the saved session (see auth.setup.ts).
 * Steps are serial because later stages depend on data created earlier.
 *
 * Steps that cannot be fully driven against a live backend are marked and
 * explained inline rather than asserting a fake pass.
 */

test.describe.configure({ mode: "serial" });

test.describe("HR admin journey", () => {
  // ---- 01 · Account provisioned / access -------------------------------
  test("01 · lands in the app after provisioning + login", async ({ page }) => {
    // Provisioning itself is done by the platform super-admin
    // (create-company-admin edge function) and isn't a self-serve UI flow,
    // so the testable surface is: the session works and the app loads.
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/auth$/);
    await expect(
      page.getByRole("heading").first(),
      "an authenticated landing screen renders",
    ).toBeVisible();
  });

  // ---- 02 · Set up team & brand ---------------------------------------
  test("02 · can reach team management", async ({ page }) => {
    await page.goto("/team");
    await expect(page).toHaveURL(/\/team/);
    // An invite affordance should exist (seat-limited in the app).
    await expect(
      page.getByRole("button", { name: /^add user$/i }),
    ).toBeVisible();

    // Sending-domain verification (manage-company-domain) ends in a DNS step
    // that can't complete in CI. Assert the UI is reachable only.
    // test.fixme(true, "Domain verification requires real DNS records.");
  });

  // ---- 03 · Post a job -------------------------------------------------
  test("03 · creates a job that appears on the public careers page", async ({
    page,
  }) => {
    await page.goto("/jobs");

    await page.getByRole("button", { name: /^add job$/i }).click();

    const jobDialog = page.getByRole("dialog", { name: /new job/i });
    await expect(jobDialog).toBeVisible();

    await jobDialog.getByRole("textbox").first().fill(scenario.job.title);
    await fillRichTextEditor(
      jobDialog.locator(".ql-editor").first(),
      scenario.job.descriptionHtml,
      scenario.job.descriptionText,
    );
    await jobDialog.getByPlaceholder(/jane smith/i).fill(scenario.job.hiringManager);
    await jobDialog.getByRole("button", { name: /video screening settings/i }).click();
    await jobDialog.getByPlaceholder(/experience with react/i).fill(scenario.screening.question);
    await jobDialog.getByRole("button", { name: /^save$/i }).click();

    // The new posting should show up in the jobs list.
    await expect(page.getByText(scenario.job.title)).toBeVisible();

    // Hand the title to the candidate journey so it applies to THIS job.
    writeHandoff({
      jobTitle: scenario.job.title,
      companySlug: env.companySlug,
      scenario,
    });
  });

  // ---- 04 · Build screening + copy link --------------------------------
  test("04 · exposes the generated job's video screening link", async ({
    page,
    context,
  }) => {
    await page.goto("/screening");

    const screeningRow = page.getByRole("row").filter({ hasText: scenario.job.title }).first();
    await expect(screeningRow).toBeVisible({ timeout: 15_000 });
    await expect(screeningRow).toContainText(scenario.screening.question.slice(0, 50));

    // Grab the /screen/:linkId URL. The app copies it to the clipboard, so we
    // try clipboard first, then fall back to scanning the page for the path.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const copyBtn = screeningRow.locator('button[title="Copy screening link"]').first();
    let link = "";
    if (await copyBtn.count()) {
      await copyBtn.click();
      link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    }
    if (!link) {
      const onPage = await page
        .getByText(/\/screen\//)
        .first()
        .textContent()
        .catch(() => "");
      link = onPage ?? "";
    }

    const match = link.match(/\/screen\/([\w-]+)/);
    expect(match, "a /screen/:linkId link is available to share").not.toBeNull();
    if (match) writeHandoff({ screeningLinkId: match[1], scenario });
  });

  // ---- 05 · Review applicants ------------------------------------------
  test("05 · reviews candidate profiles and screening submissions", async ({
    page,
  }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/candidates/);

    await expect(page.locator("tbody .animate-pulse")).toHaveCount(0, { timeout: 15_000 });

    const emptyState = page.getByText(/no candidates yet|no matching applicants found/i);
    test.skip(
      await emptyState.isVisible().catch(() => false),
      "No candidates seeded yet — seed an application to exercise this step.",
    );

    const firstCandidate = page
      .locator("tbody tr")
      .filter({ hasNotText: /no candidates yet|no matching applicants found/i })
      .first();

    test.skip(
      (await firstCandidate.count()) === 0,
      "No candidates seeded yet — seed an application to exercise this step.",
    );

    await firstCandidate.click();
    await expect(page).toHaveURL(/\/candidates\/[\w-]+/);
    // Profile should show identifying info and the résumé affordance.
    await expect(
      page.getByText(/résumé|resume|cv|download|view/i).first(),
    ).toBeVisible();
  });

  // ---- 06 · Run the pipeline -------------------------------------------
  test("06 · moves a candidate along the pipeline", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/pipeline/);

    // Stages from src/pages/Pipeline.tsx
    await expect(page.getByText(/applied/i).first()).toBeVisible();

    const appliedColumn = pipelineStage(page, /^applied$/i);
    const anyCard = appliedColumn.locator(".pipeline-card").first();
    test.skip(
      (await anyCard.count()) === 0,
      "No applied candidates on the board — seed an application first.",
    );

    const name = await pipelineCardName(anyCard);
    // Advance to "shortlisted" (the stage right after "applied").
    await moveCandidateToStage(page, anyCard, /^shortlisted$/i);
    await expect(
      pipelineStage(page, /^shortlisted$/i).locator(".pipeline-card").filter({ hasText: name }),
    ).toBeVisible();
  });

  // ---- 07 · Communicate decisions (bulk reject) ------------------------
  test("07 · bulk-rejects selected candidates", async ({ page }) => {
    await page.goto("/pipeline");

    const rejectableColumn = page
      .locator(".kanban-column")
      .filter({ has: page.getByRole("button", { name: /^reject all$/i }) })
      .filter({ has: page.locator(".pipeline-card") })
      .first();
    const card = rejectableColumn.locator(".pipeline-card").first();
    test.skip(
      (await card.count()) === 0,
      "No rejectable candidates on the board — seed an application first.",
    );

    const name = await pipelineCardName(card);
    await card.locator('[role="checkbox"]').click();

    const bulkReject = page.getByRole("button", { name: /^reject selected$/i });
    await expect(bulkReject).toBeEnabled();
    await bulkReject.click();
    // Confirm dialog copy from Pipeline.tsx
    await page.getByRole("button", { name: /^yes, reject$/i }).click();

    await expect(
      pipelineStage(page, /^rejected$/i).locator(".pipeline-card").filter({ hasText: name }),
    ).toBeVisible();
  });

  // ---- 08 · Billing & ongoing ------------------------------------------
  test("08 · views billing and an invoice", async ({ page }) => {
    await page.goto("/billing");
    await expect(page).toHaveURL(/\/billing/);

    const invoice = page.locator('a[href*="/invoices/"]').first();
    if (await invoice.count()) {
      await invoice.click();
      await expect(page).toHaveURL(/\/invoices\/[\w-]+/);
      // Invoice PDF download is generated by request-invoice-pdf /
      // get-invoice-download-url — assert the control exists; downloading the
      // signed URL is optional and environment-dependent.
      await expect(
        page.getByRole("button", { name: /download|pdf|invoice/i }).first(),
      ).toBeVisible();
    } else {
      test.info().annotations.push({
        type: "note",
        description: "No invoices yet — billing page loaded but nothing to open.",
      });
    }
  });
});
