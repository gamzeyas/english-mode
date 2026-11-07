import { expect, test } from "@playwright/test";

/**
 * Pronunciation lab. The fake mic "reads" tests/fixtures/speech-sample.wav
 * ("I work worked at a creative agency, and I'm interesting melodic
 * techno"). Without an Azure key the server rejects the assessment with a
 * configuration error; E2E_REAL_VOICE=1 checks the scored result.
 */
const REFERENCE =
  "I work at a creative agency, and I'm interested in melodic techno.";

test("pick a practice sentence and see its meaning", async ({ page }) => {
  await page.goto("/pronunciation");
  await page.getByText("TH sounds").click();
  await page
    .getByRole("button", { name: /I think this is the third time this month/ })
    .click();
  const heading = page.getByRole("heading", {
    name: "I think this is the third time this month.",
  });
  await expect(heading).toBeVisible();
  await expect(
    page.getByText("Sanırım bu, bu ay üçüncü kez oluyor.").last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  if (!process.env.E2E_REAL_VOICE) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Azure anahtarı eksik" }),
    ).toBeVisible();
  }
});

test("read your own sentence aloud and get scored", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/pronunciation");
  await page.getByRole("tab", { name: "My sentence" }).click();
  await page.getByLabel("Your sentence").fill(REFERENCE);
  await page.getByRole("button", { name: "Use this sentence" }).click();
  await expect(page.getByRole("heading", { name: REFERENCE })).toBeVisible();

  await page.getByRole("button", { name: "Record reading" }).click();
  await page.waitForTimeout(6_500);
  await page.getByRole("button", { name: /Stop recording/ }).click();

  if (!process.env.E2E_REAL_VOICE) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Azure anahtarı eksik" }),
    ).toBeVisible({ timeout: 20_000 });
    return;
  }
  await expect(page.getByText("Overall")).toBeVisible({ timeout: 30_000 });
  // The extra "work" is flagged as inserted; tapping a word shows its sounds.
  await page
    .getByRole("button", { name: /^work: \d+, Insertion$/ })
    .first()
    .click();
  await expect(page.getByText("Fazladan söylendi")).toBeVisible();
  await page.getByRole("button", { name: /^interested: \d+/ }).click();
  // en-US names each sound; en-GB scores them without names, which the
  // lab explains instead of showing unlabeled scores.
  await expect(
    page
      .getByRole("list", { name: "Sounds" })
      .or(page.getByText("ses (fonem) düzeyinde ayrıntı vermiyor")),
  ).toBeVisible();
  await expect(page.getByText("Recent attempts")).toBeVisible();
});

test("the assessment API validates its input", async ({ request }) => {
  const missing = await request.post("/api/pronunciation", {
    multipart: { reference: JSON.stringify({ source: "custom", text: "Hi" }) },
  });
  expect(missing.status()).toBe(400);
  const unknownSentence = await request.post("/api/pronunciation/reference", {
    data: { reference: { source: "catalog", ref: "nope-1" } },
  });
  expect(unknownSentence.status()).toBe(404);
  const wordNotInSentence = await request.post("/api/pronunciation/reference", {
    data: { reference: { source: "catalog", ref: "th-1" }, word: "banana" },
  });
  expect(wordNotInSentence.status()).toBe(400);
});
