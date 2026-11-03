import { expect, test } from "@playwright/test";

// Both device projects share one e2e learner; the review queue is global per
// learner, so this flow runs once (desktop) to avoid grading each other's cards.
test("add a phrase, recall it, grade it, and see it rescheduled", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "shared review queue",
  );
  const tag = Date.now().toString(36);
  const phrase = `I'd rather ${tag}...`;

  await page.goto("/learning-pool");
  await page.getByRole("button", { name: "Add phrase" }).click();
  await page.getByLabel("Phrase *").fill(phrase);
  await page.getByLabel("Meaning (Turkish)").fill(`tercih ederim ${tag}`);
  await page.getByLabel("Example").fill(`I'd rather ${tag} stay home tonight.`);
  await page.getByRole("button", { name: "Save phrase" }).click();
  await expect(page.getByText(phrase)).toBeVisible();

  // Duplicate phrases are rejected.
  await page.getByRole("button", { name: "Add phrase" }).click();
  await page.getByLabel("Phrase *").fill(phrase);
  await page.getByRole("button", { name: "Save phrase" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "zaten var" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/review");
  await expect(page.getByText(`tercih ederim ${tag}`)).toBeVisible();
  // The prompt hides the phrase.
  await expect(
    page.getByText("____ stay home tonight.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(phrase)).toHaveCount(0);

  await page.getByLabel("Your answer").fill(`I'd rather ${tag} go out`);
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Matches the phrase")).toBeVisible();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByText(/Done — 1 reviewed|Card 2 of/)).toBeVisible();

  await page.goto("/learning-pool");
  const card = page.locator("li").filter({ hasText: phrase });
  await expect(card.getByText(/Next in/)).toBeVisible();

  // Archive (moves to the Archived tab), restore, then delete.
  await card.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText(phrase)).toHaveCount(0);
  await page.getByRole("tab", { name: /Archived/ }).click();
  await card.getByRole("button", { name: "Restore" }).click();
  await page.getByRole("tab", { name: /All/ }).click();
  await card.getByRole("button", { name: `Delete ${phrase}` }).click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(phrase)).toHaveCount(0);

  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Your progress" }),
  ).toBeVisible();
});
