import { expect, test } from "@playwright/test";

/**
 * Full loop against the real Claude API: costs a few cents per run, so it
 * only runs with E2E_REAL_AI=1 and ANTHROPIC_API_KEY set.
 */
test.skip(!process.env.E2E_REAL_AI, "set E2E_REAL_AI=1 to run against Claude");
test.setTimeout(240_000);

test("talk to the coach, end the session and get grounded feedback", async ({
  page,
}) => {
  await page.goto("/conversation/new");
  await page
    .getByRole("group", { name: "Duration" })
    .getByText("5 min", { exact: true })
    .click();
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);

  const transcript = page.getByRole("log", { name: "Conversation transcript" });
  await expect(transcript.locator("li")).toHaveCount(1, { timeout: 60_000 });

  for (const answer of [
    "Hi! I'm interesting melodic techno and I work worked at a creative agency.",
    "If I could move abroad, I go to Berlin because the music scene is amazing.",
  ]) {
    const before = await transcript.locator("li").count();
    await page.getByLabel("Your message").fill(answer);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(transcript.locator("li")).toHaveCount(before + 2, {
      timeout: 60_000,
    });
  }

  await page.getByRole("button", { name: "End", exact: true }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.getByRole("heading", { name: "Top corrections" }),
  ).toBeVisible();
});
