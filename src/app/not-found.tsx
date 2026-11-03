import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="space-y-4 text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="font-heading text-2xl font-semibold">
          This page doesn&apos;t exist
        </h1>
        <p className="text-sm text-muted-foreground">Bu sayfa bulunamadı.</p>
        <Button asChild className="h-11 px-5">
          <Link href="/dashboard">Back to Today</Link>
        </Button>
      </div>
    </main>
  );
}
