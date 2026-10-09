"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { Divider, FormError, PasswordField, SubmitButton, TextField } from "@/components/auth/fields";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuthConfig } from "@/hooks/useAuthConfig";
import { api, ApiError } from "@/lib/api";
import { fieldErrors, safeNext } from "@/lib/form-errors";
import { HOME_PATH } from "@/lib/nav";
import type { AuthResult } from "@/lib/types";

function SignupForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { signIn } = useAuth();
  const config = useAuthConfig();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const finish = useCallback((result: AuthResult) => { signIn(result); router.replace(next); }, [signIn, router, next]);
  const signup = useMutation({ mutationFn: () => api.post<AuthResult>("/api/auth/signup", { name, email, password }), onSuccess: finish });
  const google = useMutation({ mutationFn: (credential: string) => api.post<AuthResult>("/api/auth/google", { credential }), onSuccess: finish });

  const apiError = (signup.error ?? google.error) as ApiError | null;
  const serverFields = apiError ? fieldErrors(apiError.message) : {};
  const formError = apiError && Object.keys(serverFields).length === 0 ? apiError.message : undefined;
  const shortPassword = touched && password.length > 0 && password.length < 8;

  return (
    <>
      <h1 className="text-[28px] font-medium tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Free to start. No credit card.</p>

      <div className="mt-8 space-y-4">
        {config.data?.google_client_id && (
          <>
            <GoogleButton clientId={config.data.google_client_id} onCredential={(c) => google.mutate(c)} />
            <Divider>or</Divider>
          </>
        )}
        <form onSubmit={(e) => { e.preventDefault(); signup.mutate(); }} className="space-y-4" noValidate>
          <FormError>{formError}</FormError>
          <TextField label="Full name" autoComplete="name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} error={serverFields.name} placeholder="Ada Lovelace" />
          <TextField label="Work email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={serverFields.email} placeholder="you@company.com" />
          <PasswordField
            label="Password" autoComplete="new-password" required value={password} onBlur={() => setTouched(true)}
            onChange={(e) => setPassword(e.target.value)} error={serverFields.password ?? (shortPassword ? "Use at least 8 characters" : undefined)}
            hint="At least 8 characters"
          />
          <SubmitButton loading={signup.isPending}>Create account</SubmitButton>
        </form>
        <p className="text-center text-[12px] leading-5 text-muted-foreground">
          By creating an account you agree to the <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </div>

      <p className="mt-8 text-center text-[14px] text-muted-foreground">
        Already have an account?{" "}
        <Link href={next === HOME_PATH ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="text-foreground underline-offset-4 hover:underline">Log in</Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
