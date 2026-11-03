import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Integration tests run against the real Supabase project from .env.local
// (`vercel env pull`). They create and delete their own temporary users.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
