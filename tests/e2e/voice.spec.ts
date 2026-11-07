import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Browser pipeline with Chromium's fake microphone: getUserMedia →
 * MediaRecorder → 16 kHz WAV → upload. Without an Azure key the server
 * accepts the audio format and then reports the missing configuration.
 */
test("record in the chat composer and reach the speech service", async ({
  page,
}) => {
  test.skip(!!process.env.E2E_REAL_VOICE, "covered by the real voice run");
  await page.goto("/conversation/new");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page).toHaveURL(/\/conversation\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Record voice" }).click();
  const stop = page.getByRole("button", { name: /Stop recording/ });
  await expect(stop).toBeVisible();
  await expect(stop).toHaveAccessibleName(/0:0[1-9]/, { timeout: 5_000 });
  await stop.click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Azure anahtarı eksik" }),
  ).toBeVisible({ timeout: 15_000 });
  // Mic tracks are released after stopping.
  await expect(
    page.getByRole("button", { name: "Record voice" }),
  ).toBeEnabled();
  // Text input keeps working as the fallback.
  await expect(page.getByLabel("Your message")).toBeEnabled();
});

test("the transcription API validates format and size", async ({ request }) => {
  const notWav = await request.post("/api/audio/transcribe", {
    multipart: {
      audio: {
        name: "x.wav",
        mimeType: "audio/wav",
        buffer: Buffer.from("not a wav file".repeat(10)),
      },
    },
  });
  expect(notWav.status()).toBe(400);
  expect((await notWav.json()).error.message).toContain("format");

  const missing = await request.post("/api/audio/transcribe", {
    multipart: { other: "x" },
  });
  expect(missing.status()).toBe(400);

  const sample = await request.post("/api/audio/transcribe", {
    multipart: {
      audio: {
        name: "speech.wav",
        mimeType: "audio/wav",
        buffer: readFileSync("tests/fixtures/speech-sample.wav"),
      },
    },
  });
  if (process.env.E2E_REAL_VOICE) {
    expect(sample.status()).toBe(200);
    expect((await sample.json()).transcript.toLowerCase()).toContain(
      "creative agency",
    );
  } else {
    expect(sample.status()).toBe(503);
  }
});

test("pick and test a microphone in Settings", async ({ page }) => {
  await page.goto("/settings");
  const card = page.locator("main").filter({ hasText: "Microphone" });
  await card.getByRole("button", { name: "Test microphone" }).click();
  // The fake device plays a tone, so the level check succeeds.
  await expect(card.getByText("Sesin geliyor")).toBeVisible({
    timeout: 10_000,
  });
  await card.getByRole("button", { name: "Stop test" }).click();
  await expect(card.getByText("Bu mikrofon çalışıyor")).toBeVisible();

  const select = card.getByLabel("Microphone", { exact: true });
  const options = await select.locator("option").allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
  await page.reload();
  await expect(page.getByLabel("Microphone", { exact: true })).not.toHaveValue(
    "",
  );
});
