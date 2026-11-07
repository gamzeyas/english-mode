import { expect, test } from "@playwright/test";
import { addE2EAssignment, addE2EListeningExercise } from "./supabase-admin";

test("dashboard shows the weekly focus from real signals", async ({ page }) => {
  await page.goto("/dashboard");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Bu haftanın odağı" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(3);
  // Nothing measured yet for this learner: no invented scores.
  await expect(card.getByText("Henüz ölçülmedi").first()).toBeVisible();
});

test("progress has listening, pronunciation and activity sections", async ({
  page,
}) => {
  await page.goto("/progress");
  for (const title of ["Listening", "Pronunciation", "When you practise"]) {
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: title }).first(),
    ).toBeVisible();
  }
});

test("settings shows estimated usage without a cap", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Usage & cost")).toBeVisible();
  await expect(page.getByText("Harcama sınırı yok")).toBeVisible();
});

test("the scenario gallery has the new variants", async ({ page }) => {
  await page.goto("/scenarios");
  for (const title of [
    "Negotiate your job offer",
    "Recruiter phone screen for a role abroad",
    "Defend a design decision",
    "Networking at an AI meetup",
  ]) {
    await expect(page.getByText(title).first()).toBeVisible();
  }
});

test("finishing a listening exercise completes today's listening task", async ({
  page,
}, testInfo) => {
  const task = `Listening task ${testInfo.project.name}`;
  await addE2EAssignment({ title: task, kind: "listening" });
  const title = `Auto-complete ${testInfo.project.name}`;
  await addE2EListeningExercise("dictation", {
    title,
    sentences: [
      {
        text: "See you soon.",
        meaning_tr: "Yakında görüşürüz.",
        focus_tr: "x",
      },
    ],
  });

  await page.goto("/listening");
  await page.getByRole("button", { name: new RegExp(`^${title} `) }).click();
  await page.getByLabel("What you heard in sentence 1").fill("see you soon");
  await page.getByRole("button", { name: "Check answers" }).click();
  await expect(page.getByText("Score 100%")).toBeVisible();
  await expect(page.getByText("Yakında görüşürüz.")).toBeVisible();

  await page.goto("/assignments");
  const card = page.locator('[data-slot="card"]').filter({ hasText: task });
  await expect(card.getByText("Done", { exact: true })).toBeVisible();
});
