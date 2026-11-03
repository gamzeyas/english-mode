import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { getProfile, type CurrentUser, type Profile } from "@/lib/auth/dal";
import { isEmailAllowed } from "@/lib/env";
import { SessionError } from "@/lib/sessions/errors";
import { createClient } from "@/lib/supabase/server";

type ApiContext = { user: CurrentUser; profile: Profile; requestId: string };

/** Like getCurrentUser(), but answers 401 instead of redirecting. */
async function getApiUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !isEmailAllowed(claims.email)) return null;
  return { id: claims.sub, email: claims.email as string };
}

/**
 * Shared route-handler wrapper (PRD §9): authentication, request id, a
 * uniform error contract `{ error: { code, message }, requestId }`, and logs
 * that never contain learner content.
 */
export function withApi<Args extends unknown[]>(
  handler: (context: ApiContext, ...args: Args) => Promise<unknown>,
) {
  return async (...args: Args) => {
    // API responses are per-user: never let a GET handler be prerendered.
    // Outside the try so Next's "stop prerendering" signal is not swallowed.
    await connection();
    const requestId = randomUUID();
    const headers = { "x-request-id": requestId, "cache-control": "no-store" };
    try {
      const user = await getApiUser();
      if (!user) throw new SessionError("unauthorized");
      const profile = await getProfile();
      const body = await handler({ user, profile, requestId }, ...args);
      // Handlers may return a ready Response (e.g. a file download).
      if (body instanceof Response) {
        for (const [key, value] of Object.entries(headers))
          body.headers.set(key, value);
        return body;
      }
      return NextResponse.json(body ?? { ok: true }, { headers });
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof SessionError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message }, requestId },
          { status: error.status, headers },
        );
      }
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: { code: "invalid_request", message: "İstek geçersiz." },
            requestId,
          },
          { status: 400, headers },
        );
      }
      console.error(
        `[api] ${requestId} unexpected error`,
        (error as Error).name,
        (error as Error).message,
      );
      return NextResponse.json(
        {
          error: { code: "internal", message: "Beklenmeyen bir hata oluştu." },
          requestId,
        },
        { status: 500, headers },
      );
    }
  };
}

/** Parses a JSON body with a size cap. */
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 16_000,
): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new SessionError("invalid_request");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new SessionError("invalid_request");
  }
  return schema.parse(json);
}

export const uuidParam = z.uuid();
