import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { E2E_EMAIL, STORAGE_STATE } from "./tests/e2e/constants";

// Real Supabase project from `vercel env pull`; the e2e user is created and
// deleted by the setup/teardown projects.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = Number(process.env.PORT ?? 3100);
const signedIn = { storageState: STORAGE_STATE };
// A fake microphone (tone) that is granted without a permission prompt.
const fakeMic = {
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      teardown: "teardown",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "teardown", testMatch: /auth\.teardown\.ts/ },
    {
      name: "desktop-chromium",
      testIgnore: /auth\.(setup|teardown)\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], ...signedIn, ...fakeMic },
    },
    {
      name: "mobile-chromium",
      testIgnore: /auth\.(setup|teardown)\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
        ...signedIn,
        ...fakeMic,
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Let the throwaway e2e account through the personal-use allowlist.
    env: {
      // Default runs never call Claude (no spend); E2E_REAL_AI=1 opts in.
      ANTHROPIC_API_KEY: process.env.E2E_REAL_AI
        ? (process.env.ANTHROPIC_API_KEY ?? "")
        : "",
      // Voice runs never call Azure unless E2E_REAL_VOICE=1.
      AZURE_SPEECH_KEY: process.env.E2E_REAL_VOICE
        ? (process.env.AZURE_SPEECH_KEY ?? "")
        : "",
      ALLOWED_EMAILS: [process.env.ALLOWED_EMAILS, E2E_EMAIL]
        .filter(Boolean)
        .join(","),
    },
  },
});
