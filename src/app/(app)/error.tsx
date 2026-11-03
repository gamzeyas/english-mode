"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Segment error boundary: keeps the app shell and offers a retry. */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Only the digest/name: never learner content.
    const digest =
      typeof error === "object" && error && "digest" in error
        ? String(error.digest)
        : undefined;
    console.error("[ui] render error", digest ?? (error as Error)?.name);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold">
        Something went wrong
      </h1>
      <p lang="tr" className="text-sm text-muted-foreground">
        Bu ekran yüklenemedi. Verilerin güvende; tekrar dene ya da ana sayfaya
        dön.
      </p>
      <div className="flex gap-2">
        <Button className="h-11" onClick={() => retry()}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/dashboard">Back to Today</Link>
        </Button>
      </div>
    </div>
  );
}
