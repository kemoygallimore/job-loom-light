import { test as setup, expect } from "@playwright/test";
import { loginAsHr } from "./helpers";
import fs from "node:fs";
import path from "node:path";

const authFile = "tests/e2e/.auth/hr-admin.json";

/**
 * Runs once before the HR journey. Logs in and persists the session so every
 * HR test starts authenticated instead of re-logging in each time.
 */
setup("authenticate HR admin", async ({ page }) => {
  await loginAsHr(page);

  // Sanity: we're really in the app, not bounced back to /auth.
  await expect(page).not.toHaveURL(/\/auth$/);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
