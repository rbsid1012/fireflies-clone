"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { FormError, PasswordField, SubmitButton } from "@/components/auth/fields";
import { api, ApiError } from "@/lib/api";
import { fieldErrors } from "@/lib/form-errors";
import { HOME_PATH } from "@/lib/nav";
import type { AuthResult } from "@/lib/types";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => api.post<AuthResult>("/api/auth/reset-password", { token, password }),
    onSuccess: (result) => { signIn(result); router.replace(HOME_PATH); },
  });
  const fields = reset.error instanceof ApiError ? fieldErrors(reset.error.message) : {};

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-[24px] font-medium">This link is incomplete</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Request a new reset link and use the one in the email.</p>
        <Link href="/forgot-password" className="mt-6 inline-block text-[14px] underline underline-offset-4">Request a new link</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-[28px] font-medium tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">You&apos;ll be signed in right after.</p>
      <form onSubmit={(e) => { e.preventDefault(); reset.mutate(); }} className="mt-8 space-y-4" noValidate>
        <FormError>{reset.error && !fields.password ? (reset.error as Error).message : undefined}</FormError>
        <PasswordField label="New password" autoComplete="new-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 8 characters" />
        <SubmitButton loading={reset.isPending}>Save password</SubmitButton>
      </form>
      {reset.error instanceof ApiError && reset.error.code === "invalid_reset_token" && (
        <Link href="/forgot-password" className="mt-6 block text-center text-[14px] underline underline-offset-4">Request a new link</Link>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
