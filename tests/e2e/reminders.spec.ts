import { expect, test } from "@playwright/test";

const reminders = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="card"]').filter({ hasText: "Daily reminder" });

test("reminder preferences are saved and survive a reload", async ({
  page,
}, testInfo) => {
  // Both projects share one learner; only one of them edits the row.
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/settings");
  const card = reminders(page);
  await expect(card).toBeVisible();

  await card.getByLabel("Daily reminder").check();
  await card.locator('input[type="time"]').fill("07:45");
  const days = card.getByRole("group", { name: "Reminder days" });
  // Weekdays only: switch Saturday and Sunday off if they are on.
  for (const day of ["Cmt", "Paz"]) {
    const button = days.getByRole("button", { name: day });
    if ((await button.getAttribute("aria-pressed")) === "true")
      await button.click();
  }
  await card.getByRole("button", { name: "Save reminder" }).click();
  await expect(card.getByText(/Kaydedildi\. Hatırlatma/)).toBeVisible();

  await page.reload();
  const reloaded = reminders(page);
  await expect(reloaded.getByLabel("Daily reminder")).toBeChecked();
  await expect(reloaded.locator('input[type="time"]')).toHaveValue("07:45");
  const reloadedDays = reloaded.getByRole("group", { name: "Reminder days" });
  await expect(
    reloadedDays.getByRole("button", { name: "Pzt" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    reloadedDays.getByRole("button", { name: "Paz" }),
  ).toHaveAttribute("aria-pressed", "false");

  // Turn it off again so the throwaway learner never gets reminders.
  await reloaded.getByLabel("Daily reminder").uncheck();
  await reloaded.getByRole("button", { name: "Save reminder" }).click();
  await expect(reloaded.getByText("Hatırlatmalar kapatıldı.")).toBeVisible();
});

test("the reminder card fits a phone screen", async ({ page }) => {
  await page.goto("/settings");
  const card = reminders(page);
  await expect(card).toBeVisible();
  await expect(card.getByText("This device")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("the scheduler endpoint rejects callers without the secret", async ({
  request,
}) => {
  const anonymous = await request.post("/api/cron/reminders", {
    maxRedirects: 0,
  });
  // 503 until `pnpm push:setup` has set CRON_SECRET; never a login redirect.
  expect([401, 503]).toContain(anonymous.status());
  const forged = await request.post("/api/cron/reminders", {
    maxRedirects: 0,
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect([401, 503]).toContain(forged.status());
});
