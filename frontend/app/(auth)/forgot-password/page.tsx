"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, MailCheck } from "lucide-react";
import { FormError, SubmitButton, TextField } from "@/components/auth/fields";
import { api, ApiError } from "@/lib/api";
import { fieldErrors } from "@/lib/form-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: () => api.post<{ message: string }>("/api/auth/forgot-password", { email }) });
  const fields = request.error instanceof ApiError ? fieldErrors(request.error.message) : {};

  if (request.isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl border bg-card"><MailCheck className="size-6 text-primary-foreground/80" /></div>
        <h1 className="text-[24px] font-medium tracking-tight">Check your email</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{request.data.message} The link works for one hour.</p>
        <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to log in</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-[28px] font-medium tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Enter your email and we&apos;ll send you a link.</p>
      <form onSubmit={(e) => { e.preventDefault(); request.mutate(); }} className="mt-8 space-y-4" noValidate>
        <FormError>{request.error && !fields.email ? (request.error as Error).message : undefined}</FormError>
        <TextField label="Email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <SubmitButton loading={request.isPending}>Send reset link</SubmitButton>
      </form>
      <Link href="/login" className="mt-8 flex items-center justify-center gap-2 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to log in</Link>
    </>
  );
}
