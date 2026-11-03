import { expect, test, type Page } from "@playwright/test";
import { addE2EAssignment } from "./supabase-admin";

const card = (page: Page, title: string) =>
  page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });

test("start a roleplay with a chosen difficulty and see its goals", async ({
  page,
}) => {
  await page.goto("/scenarios");
  await page
    .getByRole("link", { name: /Small talk at a techno festival/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Small talk at a techno festival" }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Difficulty" })
    .getByText("Hard", { exact: true })
    .click();
  await page.getByRole("button", { name: "Start roleplay" }).click();
  await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Leo · Small talk/)).toBeVisible();
  const goals = page.locator("details").filter({ hasText: "Your goals (3)" });
  await goals.getByText("Your goals (3)").click();
  await expect(goals.getByText("Ask two follow-up questions")).toBeVisible();
});

test("dashboard shows today's real plan", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Today's plan")).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ done · about \d+ min/)).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
});

test("assignments: submit, swap, skip and reschedule", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "shared assignment list",
  );
  const tag = Date.now().toString(36);
  const answerTitle = `Answer ${tag}`;
  const swapTitle = `Rewrite ${tag}`;
  const skipTitle = `Skip ${tag}`;
  const laterTitle = `Later ${tag}`;
  await addE2EAssignment({ title: answerTitle, kind: "interview_answer" });
  await addE2EAssignment({ title: swapTitle, kind: "rewrite" });
  await addE2EAssignment({ title: skipTitle, kind: "follow_up" });
  await addE2EAssignment({ title: laterTitle, kind: "follow_up" });

  await page.goto("/assignments");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // The answer is stored even though the AI coach is not configured in e2e.
  const answer = card(page, answerTitle);
  await answer
    .getByLabel("Your answer")
    .fill("I led a project that helped our team use AI tools every day.");
  await answer.getByRole("button", { name: "Submit answer" }).click();
  await expect(answer.getByText("API anahtarı eksik")).toBeVisible();
  await expect(answer.getByText("Done")).toBeVisible();
  await expect(
    answer.getByRole("button", { name: "Get feedback" }),
  ).toBeVisible();

  await card(page, swapTitle).getByRole("button", { name: "Swap" }).click();
  await expect(card(page, swapTitle)).toHaveCount(0);

  await card(page, skipTitle).getByRole("button", { name: "Skip" }).click();
  await expect(card(page, skipTitle).getByText("Skipped")).toBeVisible();

  await card(page, laterTitle)
    .getByRole("button", { name: "Tomorrow" })
    .click();
  await expect(card(page, laterTitle)).toHaveCount(0);

  await page.reload();
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(
    upcoming.getByRole("heading", { name: laterTitle }),
  ).toBeVisible();
  await expect(
    card(page, answerTitle).getByText("I led a project"),
  ).toBeVisible();
});

test("writing coach reports a missing AI key without losing the text", async ({
  page,
}) => {
  test.skip(!!process.env.E2E_REAL_AI, "covered by real-ai.spec.ts");
  await page.goto("/writing");
  await page
    .getByLabel("Your text")
    .fill("Hi Anna, I write you for ask about the role.");
  await page.getByLabel("What should it achieve?").fill("Ask for a call");
  await page
    .getByRole("group", { name: "Register" })
    .getByText("Formal")
    .click();
  await page.getByRole("button", { name: "Improve my text" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "API anahtarı eksik" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your text")).toHaveValue(/I write you/);
});

test("baseline needs enough words before it can be submitted", async ({
  page,
}) => {
  test.skip(!!process.env.E2E_REAL_AI, "covered by real-ai.spec.ts");
  await page.goto("/assessment");
  const submit = page.getByRole("button", { name: "Submit answers" });
  await expect(submit).toBeDisabled();
  const sentence =
    "I work as a creative director and I lead a small team that uses AI tools for brand content every single day.";
  for (const label of [
    /Introduce yourself/,
    /project you are proud of/,
    /any city/,
  ]) {
    await page.getByLabel(label).fill(sentence);
  }
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "API anahtarı eksik" }),
  ).toBeVisible();
});
