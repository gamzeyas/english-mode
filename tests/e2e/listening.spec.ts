import { expect, test } from "@playwright/test";
import { addE2ECoachMessage, addE2EListeningExercise } from "./supabase-admin";

/**
 * Listening practice with seeded material: grading is deterministic and
 * server-side, so no Claude call is needed. Audio needs Azure; without a key
 * the play buttons surface the configuration error instead.
 */
test("dictation: play, type, and see word-level grading", async ({
  page,
}, testInfo) => {
  const title = `Dictation ${testInfo.project.name}`;
  await addE2EListeningExercise("dictation", {
    title,
    sentences: [
      { text: "I'm working on a new project.", focus_tr: "I'm kısaltması." },
      {
        text: "She has been living in Berlin.",
        focus_tr: "has been zayıf okunur.",
      },
    ],
  });
  await page.goto("/listening");
  await page.getByRole("button", { name: new RegExp(`^${title} `) }).click();
  const card = page.locator("main").getByRole("heading", { name: title });
  await expect(card).toBeVisible();

  await page.getByRole("button", { name: "Play" }).first().click();
  if (!process.env.E2E_REAL_VOICE) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Azure anahtarı eksik" }),
    ).toBeVisible();
  }

  await page
    .getByLabel("What you heard in sentence 1")
    .fill("im working on a new project");
  await page
    .getByLabel("What you heard in sentence 2")
    .fill("she been leaving in Berlin");
  await page.getByRole("button", { name: "Check answers" }).click();

  await expect(page.getByText("Sentence 1 · 6/6")).toBeVisible();
  await expect(page.getByText("Sentence 2 · 4/6")).toBeVisible();
  await expect(page.getByText("(you: leaving)")).toBeVisible();
  await expect(page.getByText("Score 83%")).toBeVisible();
});

test("comprehension: answer questions, then see key and transcript", async ({
  page,
}, testInfo) => {
  const title = `Quiz ${testInfo.project.name}`;
  await addE2EListeningExercise("comprehension", {
    title,
    context_tr: "İki meslektaş kahve molasında.",
    lines: [
      { speaker: "a", text: "Are you coming to the launch on Friday?" },
      { speaker: "b", text: "I can't, I'm flying to Lisbon for a client." },
      { speaker: "a", text: "That's a shame. Maybe next time." },
      { speaker: "b", text: "Definitely, send me the photos." },
    ],
    questions: [
      {
        question: "Why can't speaker B come?",
        options: ["She is sick", "She is travelling for work", "She forgot"],
        answer_index: 1,
        explanation_tr: "B, bir müşteri için Lizbon'a uçtuğunu söylüyor.",
      },
      {
        question: "When is the launch?",
        options: ["Friday", "Monday"],
        answer_index: 0,
        explanation_tr: "A, Cuma gününden bahsediyor.",
      },
    ],
  });
  await page.goto("/listening");
  await page.getByRole("button", { name: new RegExp(`^${title} `) }).click();
  await expect(page.getByText("İki meslektaş kahve molasında.")).toBeVisible();
  // The transcript stays hidden until the answers are in.
  await expect(page.getByText("flying to Lisbon")).toHaveCount(0);

  await page.getByText("She is travelling for work").click();
  await page.getByText("Monday").click();
  await page.getByRole("button", { name: "Check answers" }).click();

  await expect(page.getByText("Score 50%")).toBeVisible();
  await expect(page.getByLabel("Correct", { exact: true })).toHaveCount(1);
  await expect(page.getByText("(senin cevabın: Monday)")).toBeVisible();
  await page.getByText("Transcript").click();
  await expect(
    page.getByText("I can't, I'm flying to Lisbon for a client."),
  ).toBeVisible();
});

test("chat: listening options and coach audio", async ({ page }) => {
  await page.goto("/conversation/new");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").pop()!;
  await addE2ECoachMessage(sessionId, "Hi! What are you working on this week?");
  await page.reload();

  const coach = page.getByText("What are you working on this week?");
  await expect(coach).toBeVisible();
  const listenFirst = page.getByRole("button", { name: "Listen first" });
  await listenFirst.click();
  await expect(listenFirst).toHaveAttribute("aria-pressed", "true");
  await expect(coach).toHaveCount(0);
  await expect(page.getByText("Önce dinle — metin gizli").last()).toBeVisible();

  // The preference survives a reload (per-browser setting).
  await page.reload();
  await expect(page.getByText("Önce dinle — metin gizli").last()).toBeVisible();
  await page.getByRole("button", { name: "Show text" }).last().click();
  await expect(coach).toBeVisible();

  await page.getByRole("button", { name: "Play audio" }).last().click();
  if (!process.env.E2E_REAL_VOICE) {
    await expect(
      page.getByRole("alert").filter({ hasText: "Azure anahtarı eksik" }),
    ).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Stop audio" })).toBeVisible({
      timeout: 15_000,
    });
  }
  await page.getByRole("button", { name: "Listen first" }).click();

  // Turkish meanings are on by default and can be switched off.
  const turkish = page.getByRole("button", { name: "Türkçe" });
  await expect(turkish).toHaveAttribute("aria-pressed", "true");
  await turkish.click();
  await expect(turkish).toHaveAttribute("aria-pressed", "false");
  await turkish.click();

  // Hints answer the coach's latest turn.
  await page.getByRole("button", { name: "İpucu" }).click();
  await expect(page.locator("#conversation-hints")).toBeVisible();
  if (!process.env.E2E_REAL_AI) {
    await expect(
      page.locator("#conversation-hints").getByRole("alert"),
    ).toContainText("API anahtarı eksik");
  }
  await page.getByRole("button", { name: "Close hints" }).click();
  await expect(page.locator("#conversation-hints")).toHaveCount(0);
});

test("speech endpoints only speak server-owned text", async ({ request }) => {
  const missing = await request.post(
    "/api/messages/00000000-0000-4000-8000-000000000000/speech",
    { data: { rate: "normal" } },
  );
  expect(missing.status()).toBe(404);
  const notListening = await request.post(
    "/api/listening/00000000-0000-4000-8000-000000000000/audio",
    { data: { item: 0 } },
  );
  expect(notListening.status()).toBe(404);
});
