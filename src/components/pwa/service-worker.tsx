"use client";

import { useEffect } from "react";

/** Registers the offline-fallback service worker (production builds only). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // The app works without it; only the offline page is lost.
      });
  }, []);
  return null;
}
