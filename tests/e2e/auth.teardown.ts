import { expect, test as teardown } from "@playwright/test";
import { STORAGE_STATE } from "./constants";
import { deleteE2EUser } from "./supabase-admin";

teardown.use({ storageState: STORAGE_STATE });

// Runs after every signed-in test: sign-out revokes the shared session.
teardown("sign out, then delete the e2e learner", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

  await deleteE2EUser();
});
