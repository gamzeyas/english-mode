import { randomUUID } from "node:crypto";
import { expect, test as setup } from "@playwright/test";
import { E2E_EMAIL, STORAGE_STATE } from "./constants";
import { resetE2EUser } from "./supabase-admin";

setup("sign in and complete onboarding", async ({ page }) => {
  const password = randomUUID();
  await resetE2EUser(password);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A new learner is sent to onboarding before the dashboard.
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("E2E");
  await page.getByText("Career", { exact: true }).click();
  await page.getByText("Spoken fluency").click();
  await page.getByRole("button", { name: "Melodic techno" }).click();
  await page.getByRole("button", { name: "Travel" }).click();
  await page.getByText("15 min").click();
  await page.getByText("British (en-GB)").click();
  await page.getByText("Store my learning data").click();
  await page.getByRole("button", { name: "Start learning" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Hi E2E/ })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
