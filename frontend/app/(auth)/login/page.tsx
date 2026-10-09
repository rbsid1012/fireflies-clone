"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Divider, FormError, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuthConfig } from "@/hooks/useAuthConfig";
import { api, ApiError } from "@/lib/api";
import { fieldErrors, safeNext } from "@/lib/form-errors";
import { HOME_PATH } from "@/lib/nav";
import type { AuthResult } from "@/lib/types";

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { signIn } = useAuth();
  const config = useAuthConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const finish = useCallback((result: AuthResult) => {
    signIn(result);
    router.replace(next);
  }, [signIn, router, next]);

  const login = useMutation({ mutationFn: () => api.post<AuthResult>("/api/auth/login", { email, password }), onSuccess: finish });
  const demo = useMutation({ mutationFn: () => api.post<AuthResult>("/api/auth/demo"), onSuccess: finish });
  const google = useMutation({ mutationFn: (credential: string) => api.post<AuthResult>("/api/auth/google", { credential }), onSuccess: finish });

  const error = [login, demo, google].map((m) => m.error).find(Boolean) as ApiError | undefined;
  const fields = login.error instanceof ApiError ? fieldErrors(login.error.message) : {};
  const formError = error && Object.keys(fields).length === 0 ? error.message : undefined;

  return (
    <>
      <h1 className="text-[28px] font-medium tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Log in to your meeting notes.</p>

      <div className="mt-8 space-y-4">
        {config.data?.google_client_id && (
          <>
            <GoogleButton clientId={config.data.google_client_id} onCredential={(c) => google.mutate(c)} />
            <Divider>or</Divider>
          </>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); login.mutate(); }}
          className="space-y-4" noValidate
        >
          <FormError>{formError}</FormError>
          <TextField label="Email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} placeholder="you@company.com" />
          <PasswordField label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
          <div className="-mt-1 text-right text-[13px]">
            <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot password?</Link>
          </div>
          <SubmitButton loading={login.isPending}>Log in</SubmitButton>
        </form>

        {config.data?.demo_login_enabled && (
          <button
            type="button" onClick={() => demo.mutate()} disabled={demo.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input bg-card text-[15px] transition-colors hover:bg-accent disabled:opacity-60"
          >
            <Sparkles className="size-4 text-primary-foreground/80" /> {demo.isPending ? "Opening the demo…" : "Try the demo account"}
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-[14px] text-muted-foreground">
        New here?{" "}
        <Link href={next === HOME_PATH ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="text-foreground underline-offset-4 hover:underline">Create an account</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
