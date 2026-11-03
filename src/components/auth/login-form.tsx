"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NOT_ALLOWED =
  "Bu hesabın uygulamaya erişimi yok. Uygulama şu an yalnızca davetli kullanıcılara açık.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signIn,
    { error: null, email: "" },
  );
  const error =
    state.error ??
    (searchParams.get("error") === "not_allowed" ? NOT_ALLOWED : null);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="h-11"
          aria-invalid={!!error}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
          aria-invalid={!!error}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full text-base"
      >
        <LogIn aria-hidden />
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
