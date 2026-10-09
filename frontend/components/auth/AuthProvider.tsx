"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { clearToken, setToken, useToken } from "@/lib/auth-storage";
import type { AuthResult, User } from "@/lib/types";

type Status = "loading" | "authed" | "anon" | "error";

type AuthContextValue = {
  status: Status;
  user: User | null;
  /** Store the token from a login/signup response and make that user current. */
  signIn: (result: AuthResult) => void;
  signOut: () => void;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const token = useToken();
  const qc = useQueryClient();
  const router = useRouter();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/api/me"),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { refetch } = me;

  const signIn = useCallback(
    (result: AuthResult) => {
      qc.clear(); // nothing from a previous account may linger in the cache
      setToken(result.token);
      qc.setQueryData(["me"], result.user);
    },
    [qc],
  );

  const signOut = useCallback(() => {
    clearToken();
    qc.clear();
    router.replace("/login");
  }, [qc, router]);

  const value = useMemo<AuthContextValue>(() => {
    let status: Status;
    if (!token) status = "anon";
    else if (me.data) status = "authed";
    else if (me.isError) status = me.error instanceof ApiError && me.error.status === 401 ? "anon" : "error";
    else status = "loading";
    return { status, user: me.data ?? null, signIn, signOut, retry: () => void refetch() };
  }, [token, me.data, me.isError, me.error, refetch, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
