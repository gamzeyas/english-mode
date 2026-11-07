// One-time Web Push setup (Milestone 8b). Run it yourself:
//
//   pnpm push:setup              # first time (reuses existing VAPID keys)
//   pnpm push:setup --rotate     # new VAPID keys (every device re-enables)
//   pnpm push:setup --url https://<your-domain>/api/cron/reminders
//
// It generates the VAPID key pair and a scheduler secret, stores them in the
// linked Vercel project (production + development) and in .env.local, and
// gives the Supabase pg_cron job the endpoint URL and secret (Vault). Secret
// values are never printed. Redeploy afterwards so production picks them up.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const ENV_FILE = ".env.local";
const args = process.argv.slice(2);
const rotate = args.includes("--rotate");
const urlFlag = args.indexOf("--url");
const cronUrl =
  urlFlag >= 0
    ? args[urlFlag + 1]
    : "https://english-mode.vercel.app/api/cron/reminders";

if (!cronUrl?.startsWith("https://")) {
  console.error("--url must be an https:// URL.");
  process.exit(1);
}

const {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SECRET_KEY: secretKey,
} = process.env;
if (!supabaseUrl || !secretKey) {
  console.error(
    "Supabase is not configured in .env.local (run `vercel env pull`).",
  );
  process.exit(1);
}

const existing =
  !rotate && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      }
    : null;
const vapid = existing ?? webpush.generateVAPIDKeys();
const values = {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  CRON_SECRET: randomBytes(32).toString("base64url"),
};
const sensitive = new Set(["VAPID_PRIVATE_KEY", "CRON_SECRET"]);

// 1. Vercel project env (value via stdin, so it never appears in argv).
for (const [name, value] of Object.entries(values)) {
  for (const target of ["production", "development"]) {
    const flags =
      target === "production" && sensitive.has(name) ? ["--sensitive"] : [];
    const result = spawnSync(
      "vercel",
      ["env", "add", name, target, ...flags, "--force", "--yes"],
      { input: value, stdio: ["pipe", "ignore", "pipe"], encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(`Vercel: ${name} (${target}) failed.`);
      console.error(result.stderr.replaceAll(value, "***"));
      process.exit(1);
    }
    console.info(`Vercel: ${name} → ${target}`);
  }
}

// 2. Local env file.
let file = readFileSync(ENV_FILE, "utf8");
for (const [name, value] of Object.entries(values)) {
  const line = `${name}="${value}"`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  file = pattern.test(file)
    ? file.replace(pattern, line)
    : `${file.trimEnd()}\n${line}\n`;
}
writeFileSync(ENV_FILE, file);
console.info(`${ENV_FILE}: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET`);

// 3. Scheduler (Supabase Vault, read by the pg_cron job).
const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error } = await admin.rpc("configure_reminder_trigger", {
  p_url: cronUrl,
  p_secret: values.CRON_SECRET,
});
if (error) {
  console.error("Supabase scheduler configuration failed:", error.message);
  process.exit(1);
}
console.info(`Supabase scheduler → ${cronUrl} every 15 minutes`);
console.info(
  existing
    ? "Kept the existing VAPID keys; devices stay subscribed."
    : "New VAPID keys: enable notifications again on each device.",
);
console.info("Now redeploy: vercel deploy --prod");
