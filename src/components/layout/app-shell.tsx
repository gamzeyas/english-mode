import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BrandMark } from "@/components/layout/brand-mark";
import { OnboardingGate } from "@/components/layout/onboarding-gate";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { SideRail } from "@/components/layout/side-rail";

/**
 * Navigation reads the pathname, which suspends under Cache Components on
 * routes with request-time params; Suspense keeps the rest of the shell static.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Suspense
        fallback={
          <div className="hidden w-60 shrink-0 border-r bg-sidebar md:block" />
        }
      >
        <SideRail />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="flex h-14 items-center border-b px-4 md:hidden">
          <Link
            href="/dashboard"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            <BrandMark />
          </Link>
        </header>
        <main id="main" className="flex-1 pb-24 md:pb-6">
          {/* Reads the session, so it streams in without blocking the shell. */}
          <Suspense fallback={null}>
            <OnboardingGate />
          </Suspense>
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
      {children}
    </div>
  );
}
