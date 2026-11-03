// Creates (or resets the password of) a confirmed email+password user.
// There is no public sign-up in the app; accounts are provisioned here.
//
//   pnpm user:create you@example.com
//
// The password is read from a hidden prompt so it never lands in shell
// history or logs. Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
// (loaded from .env.local by the package script).
import { createClient } from "@supabase/supabase-js";
import { stdin, stdout } from "node:process";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: pnpm user:create <email>");
  process.exit(1);
}
if (!url || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run `vercel env pull` first.",
  );
  process.exit(1);
}
if (!stdin.isTTY) {
  console.error(
    "Run this in an interactive terminal so the password can be typed hidden.",
  );
  process.exit(1);
}

const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase());
if (!allowed.includes(email)) {
  console.warn(
    `Warning: ${email} is not in ALLOWED_EMAILS, so it will not be able to sign in.`,
  );
}

function promptHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char) => {
      if (char === "\u0003") process.exit(130); // Ctrl+C
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await promptHidden("Password (min 12 characters): ");
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
if ((await promptHidden("Repeat password: ")) !== password) {
  console.error("Passwords do not match.");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match || data.users.length < 200) return match ?? null;
  }
}

const existing = await findUserByEmail(email);
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error(`Could not update password: ${error.message}`);
    process.exit(1);
  }
  console.log(`Password updated for ${email}.`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error(`Could not create user: ${error.message}`);
    process.exit(1);
  }
  console.log(`User ${email} created. Sign in at /login.`);
}
