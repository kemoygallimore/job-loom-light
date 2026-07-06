import { defineConfig, devices } from "@playwright/test";

/**
 * Standalone E2E config for the RizonHire journey tests.
 *
 * Why a separate file: your repo's `playwright.config.ts` uses the Lovable
 * wrapper (`createLovableConfig`). This config is self-contained so you can run
 * the journey suite directly:
 *
 *   npx playwright test --config=playwright.config.e2e.ts
 *
 * Set values in `.env.e2e` (copy from `.env.e2e.example`) before running.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.e2e" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./tests/e2e",
  // Steps within a journey depend on each other (HR creates the job the
  // candidate applies to), so we keep each spec serial internally.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // 1. Log the HR admin in once and save the session to disk.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // 2. HR admin journey — reuses the saved session.
    {
      name: "hr-admin",
      testMatch: /hr-admin-journey\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/hr-admin.json",
      },
    },

    // 3. Candidate journey — runs unauthenticated (public routes), but needs
    //    fake camera/mic so the video-screening step can proceed headlessly.
    {
      name: "candidate",
      testMatch: /candidate-journey\.spec\.ts/,
      dependencies: ["setup"], // only so HR-created job/link is available; see notes
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],

  /**
   * Optional: let Playwright start your dev server automatically.
   * Uncomment and set the right command/port if you test against localhost.
   */
  // webServer: {
  //   command: "npm run dev",
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
