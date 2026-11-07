import { expect, test } from "@playwright/test";
import { addE2EPoolPhrase } from "./supabase-admin";

/**
 * Next keeps visited routes mounted (hidden) and restores them on return.
 * Lists seeded from server props must show data saved elsewhere meanwhile
 * (e.g. phrases accepted on the feedback page) when the learner comes back.
 */
test("the pool shows phrases saved elsewhere after navigating back", async ({
  page,
}, testInfo) => {
  const phrase = `saved elsewhere ${testInfo.project.name} ${Date.now()}`;
  await page.goto("/learning-pool");
  await expect(
    page.getByRole("heading", { name: "Your learning pool" }),
  ).toBeVisible();

  const nav = page.getByRole("navigation").first();
  await nav.getByRole("link", { name: "Speak" }).click();
  await expect(page).toHaveURL(/\/conversation\/new$/);
  await addE2EPoolPhrase(phrase);
  await nav.getByRole("link", { name: "Pool" }).click();
  await expect(page).toHaveURL(/\/learning-pool$/);
  await expect(page.getByText(phrase)).toBeVisible();
});
