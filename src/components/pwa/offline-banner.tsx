"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/** Connectivity banner; navigations retry automatically when back online. */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-secondary px-4 py-2 text-sm"
    >
      <WifiOff aria-hidden className="size-4 text-primary" />
      <span lang="tr">
        Çevrimdışısın. Bağlantı gelince kaldığın yerden devam eder.
      </span>
    </div>
  );
}
