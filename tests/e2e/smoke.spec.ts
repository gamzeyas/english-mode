import { expect, test } from "@playwright/test";

test("dashboard shows the learner's own profile", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Hi E2E/ })).toBeVisible();
  await expect(page.getByText("Günlük hedefin: 15 dakika.")).toBeVisible();
  await expect(page.getByText("Melodic techno")).toBeVisible();
});

test("settings show saved preferences and consent", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("en-GB")).toBeVisible();
  await expect(page.getByText("e2e@english-mode.test")).toBeVisible();
  const privacy = page
    .locator("dl")
    .filter({ hasText: "Learning data storage" });
  await expect(privacy).toContainText("Granted");
});

test("primary navigation reaches pool and scenarios", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page
    .getByRole("navigation", { name: "Primary" })
    .filter({ visible: true });

  await nav.getByRole("link", { name: "Pool" }).click();
  await expect(page).toHaveURL(/\/learning-pool$/);
  await expect(
    page.getByRole("heading", { name: "Your learning pool" }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Simulate" }).click();
  await expect(page).toHaveURL(/\/scenarios$/);
  await page.getByRole("link", { name: /AI transformation lead/ }).click();
  await expect(
    page.getByRole("heading", { name: /AI transformation lead/ }),
  ).toBeVisible();
});

test("conversation persists messages and reports a missing AI key", async ({
  page,
}) => {
  test.skip(!!process.env.E2E_REAL_AI, "covered by real-ai.spec.ts");
  await page.goto("/conversation/new");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Say hi to start")).toBeVisible();

  await page.getByLabel("Your message").fill("I worked at a creative agency.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "API anahtarı eksik" }),
  ).toBeVisible();

  // The learner message was stored even though the coach could not answer.
  await page.reload();
  await expect(page.getByText("I worked at a creative agency.")).toBeVisible();
  await expect(page.getByText("1 turn")).toBeVisible();
});

test("unknown conversation id renders not-found", async ({ page }) => {
  for (const path of [
    "/conversation/not-a-uuid",
    "/conversation/00000000-0000-4000-8000-000000000000",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "This page doesn't exist" }),
    ).toBeVisible();
  }
});

test("page has no horizontal overflow", async ({ page }) => {
  for (const path of [
    "/dashboard",
    "/learning-pool",
    "/scenarios",
    "/conversation/new",
    "/settings",
    "/onboarding",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
