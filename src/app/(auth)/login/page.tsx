import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-4">
          <BrandMark />
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Kaldığın yerden devam etmek için giriş yap.
            </p>
          </div>
        </div>
        {/* The form reads ?next= and ?error= from the URL, which is request data. */}
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
