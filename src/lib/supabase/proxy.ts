import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the Supabase session cookie on every request and performs the
 * optimistic auth redirect. Authorization itself is enforced again in the
 * data access layer and by RLS; this is only the fast path.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = requireSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // getClaims() validates the JWT; do not run code between client creation
  // and this call, or sessions can be dropped unexpectedly.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const signedIn = !!claims?.sub;
  // A valid session for an email outside the allowlist is treated as signed out.
  const allowed = signedIn && isEmailAllowed(claims?.email);
  const { pathname, search } = request.nextUrl;

  if (!allowed && pathname.startsWith("/api/")) {
    const unauthorized = NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Oturumun sona ermiş. Tekrar giriş yap.",
        },
      },
      { status: 401 },
    );
    for (const cookie of response.cookies.getAll())
      unauthorized.cookies.set(cookie);
    return unauthorized;
  }

  if (!allowed && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (signedIn) loginUrl.searchParams.set("error", "not_allowed");
    else if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + search);
    }
    return redirectWithCookies(loginUrl, response);
  }

  if (allowed && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return redirectWithCookies(dashboardUrl, response);
  }

  return response;
}

/** Keeps refreshed session cookies when the proxy answers with a redirect. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = from.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}
