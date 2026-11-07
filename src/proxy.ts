import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, the PWA manifest, its icons, the
    // service worker, the offline page and scheduler endpoints (which check
    // their own bearer secret instead of a learner session).
    "/((?!api/cron/|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest-assets/|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
