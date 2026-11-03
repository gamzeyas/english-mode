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

test.describe("Milestone 4 with real Claude", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "one learner; run the paid flows once",
    );
  });

  test("roleplay ends with an evidence-based debrief and a follow-up task", async ({
    page,
  }) => {
    await page.goto("/scenarios/festival-small-talk");
    await page.getByRole("button", { name: "Start roleplay" }).click();
    await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);
    const transcript = page.getByRole("log", {
      name: "Conversation transcript",
    });
    await expect(transcript.locator("li")).toHaveCount(1, { timeout: 60_000 });

    for (const answer of [
      "Hey! I'm into melodic techno, I came for Afterlife tonight. Who are you here to see?",
      "Nice! Have you been to Berlin? Maybe we can meet again at the next stage later?",
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
    await expect(
      page.getByRole("heading", { name: "Scenario debrief" }),
    ).toBeVisible({ timeout: 120_000 });
    // The learner used the target phrase, so the goal needs a cited message.
    await expect(
      page.getByText(/Use “I'm into…” — (met|partly met)/),
    ).toBeAttached();

    await page.goto("/assignments");
    await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
  });

  test("writing coach improves a text and checks the revision", async ({
    page,
  }) => {
    await page.goto("/writing");
    await page
      .getByLabel("Your text")
      .fill(
        "Hi Anna, I write you for ask about the AI lead role. I am very interesting and I have 10 years experience in creative agency.",
      );
    await page
      .getByLabel("What should it achieve?")
      .fill("Ask the recruiter for a short call next week");
    await page.getByRole("button", { name: "Improve my text" }).click();
    await expect(
      page.getByRole("heading", { name: "Improved version" }),
    ).toBeVisible({ timeout: 120_000 });

    await page
      .getByLabel("Your revision")
      .fill(
        "Hi Anna, I'm writing to ask about the AI lead role. I'm very interested and I have ten years of experience at a creative agency.",
      );
    await page.getByRole("button", { name: "Check my revision" }).click();
    await expect(page.getByText("A natural version")).toBeVisible({
      timeout: 120_000,
    });
  });

  test("baseline returns an informal, evidence-based result", async ({
    page,
  }) => {
    await page.goto("/assessment");
    const answers = [
      "Hi, I'm a creative director from Istanbul. I lead AI transformation in a content agency and I'm looking for a role abroad where I can build AI products.",
      "Last year we presentationing brand report manually. I developed an AI workflow that writes the first draft, and now the team saves two days every month and clients get reports faster.",
      "If I could live anywhere for a year, I go to Berlin because of the techno scene. A normal day would be work in a startup, then cycling and concerts at night.",
    ];
    const labels = [
      /Introduce yourself/,
      /project you are proud of/,
      /any city/,
    ];
    for (const [index, label] of labels.entries()) {
      await page.getByLabel(label).fill(answers[index]);
    }
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(
      page.getByRole("heading", { name: /^Baseline ·/ }),
    ).toBeVisible({ timeout: 180_000 });
    await expect(page.getByText("Approximate written level:")).toBeVisible();
    await expect(
      page.getByText(/Bir sonraki eşleştirilmiş görev/),
    ).toBeVisible();
  });
});
