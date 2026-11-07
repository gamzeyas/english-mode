import { z } from "zod";

/**
 * Environment validation. Public (NEXT_PUBLIC_*) values may reach the browser;
 * server values must only be read from server code via `getServerEnv()`.
 *
 * Schemas keep keys optional so lint/test/build work without secrets (CI).
 * Features that need a value call a `require*` helper, which fails loudly at
 * request time instead of silently running unconfigured.
 */

const optionalUrl = z.url().optional();
const optionalSecret = z.string().min(1).optional();

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalSecret,
});

export const serverEnvSchema = publicEnvSchema.extend({
  /** Bypasses RLS. Scripts/tests and server-only jobs; never the browser. */
  SUPABASE_SECRET_KEY: optionalSecret,
  /** Comma-separated emails allowed to sign in (personal-use gate). */
  ALLOWED_EMAILS: z.string().optional(),
  ANTHROPIC_API_KEY: optionalSecret,
  /** Override the coach / analyzer model (defaults in src/lib/ai/config.ts). */
  AI_CHAT_MODEL: z.string().min(1).optional(),
  AI_ANALYSIS_MODEL: z.string().min(1).optional(),
  AI_FAST_MODEL: z.string().min(1).optional(),
  AZURE_SPEECH_KEY: optionalSecret,
  AZURE_SPEECH_REGION: z.string().min(1).optional(),
  /** Optional custom endpoint (https://<resource>.cognitiveservices.azure.com). */
  AZURE_SPEECH_ENDPOINT: z.url().optional(),
  /** Web Push (VAPID) key pair; the public key is also sent to the browser. */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: optionalSecret,
  /** Contact for push services: a mailto: or https: URL. */
  VAPID_SUBJECT: z.string().min(1).optional(),
  /** Bearer secret the scheduler sends to /api/cron/reminders. */
  CRON_SECRET: z.string().min(32).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Treat empty strings (common in copied .env files) as unset. */
function compact(source: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  const result = publicEnvSchema.safeParse(compact(source));
  if (!result.success) {
    throw new Error(
      `Invalid public environment: ${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(compact(source));
  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser.");
  }
  return parseServerEnv(process.env);
}

export function requireSupabasePublicEnv(env: PublicEnv = getServerEnv()) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (run `vercel env pull`).",
    );
  }
  return { url, key };
}

export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Personal-use gate. With no ALLOWED_EMAILS configured nobody is allowed, so
 * a misconfigured deployment fails closed (PRD §14).
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowed: Set<string> = parseAllowedEmails(getServerEnv().ALLOWED_EMAILS),
): boolean {
  return !!email && allowed.has(email.trim().toLowerCase());
}
