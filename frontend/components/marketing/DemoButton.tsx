"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { HOME_PATH } from "@/lib/nav";
import type { AuthResult } from "@/lib/types";

/** Starts the demo account straight from the landing page, with no login form in between. */
export function DemoButton({ className }: { className: string }) {
  const router = useRouter();
  const { signIn } = useAuth();
  const demo = useMutation({
    mutationFn: () => api.post<AuthResult>("/api/auth/demo"),
    onSuccess: (result) => { signIn(result); router.replace(HOME_PATH); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't start the demo."),
  });
  return (
    <button type="button" onClick={() => demo.mutate()} disabled={demo.isPending} className={className}>
      {demo.isPending ? "Opening the demo…" : "Try the demo"}
    </button>
  );
}
