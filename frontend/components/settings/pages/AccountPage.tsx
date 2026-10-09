"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, LogOut, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { UserTile } from "@/components/layout/UserTile";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth-storage";
import type { User } from "@/lib/types";
import { Group, Row, SettingsPage } from "../primitives";

const input = "h-10 w-full rounded-lg border border-input bg-background px-3 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60";

function ProfileForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const save = useMutation({
    mutationFn: () => api.patch<User>("/api/me", { name }),
    onSuccess: (u) => { qc.setQueryData(["me"], u); toast.success("Name updated"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update your name."),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== user.name) save.mutate(); }} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <label htmlFor="acct-name" className="text-[13px] text-muted-foreground">Name</label>
        <input id="acct-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={user.is_demo} />
      </div>
      <Button type="submit" size="lg" className="h-10 px-4 text-[14px]" disabled={user.is_demo || save.isPending || !name.trim() || name.trim() === user.name}>Save</Button>
    </form>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => api.post<{ message: string }>("/api/me/password", { current_password: current, new_password: next }),
    onSuccess: () => { toast.success(hasPassword ? "Password changed" : "Password set"); setCurrent(""); setNext(""); },
  });
  const error = change.error instanceof ApiError ? change.error.message.replace(/^new_password: /, "") : null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); change.mutate(); }} className="grid gap-3 sm:grid-cols-2" noValidate>
      {hasPassword && (
        <div className="space-y-1.5">
          <label htmlFor="pw-current" className="text-[13px] text-muted-foreground">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" className={input} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="pw-new" className="text-[13px] text-muted-foreground">New password</label>
        <input id="pw-new" type="password" autoComplete="new-password" className={input} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" size="lg" className="h-10 gap-2 px-4 text-[14px]" disabled={change.isPending || next.length < 8 || (hasPassword && !current)}>{change.isPending && <Loader2 className="size-4 animate-spin" />} {hasPassword ? "Change password" : "Set a password"}</Button></div>
    </form>
  );
}

export function AccountPage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const remove = useMutation({
    mutationFn: () => api.delete("/api/me", { password: password || null }),
    onSuccess: () => { clearToken(); qc.clear(); router.replace("/"); },
  });
  if (!user) return null;
  const error = remove.error instanceof ApiError ? remove.error.message : null;

  return (
    <SettingsPage title="Account" description="Your profile and sign-in.">
      <Group title="Profile">
        <div className="flex items-center gap-4 px-5 py-4">
          <UserTile name={user.name} className="size-12 rounded-xl text-lg" />
          <div className="min-w-0"><p className="truncate text-[16px] font-medium">{user.name}</p><p className="truncate text-[14px] text-muted-foreground">{user.email}</p></div>
        </div>
        <div className="px-5 py-4"><ProfileForm key={user.name} user={user} /></div>
        {user.is_demo && <p className="px-5 py-3 text-[13px] text-muted-foreground">This is the shared demo account, so its profile can&apos;t be changed. Create your own account to make changes.</p>}
      </Group>

      {!user.is_demo && (
        <Group title="Password">
          <Row icon={KeyRound} title={user.has_password ? "Change your password" : "Set a password"} description={user.has_password ? undefined : "You signed in with Google. Set a password to also log in with your email."} stacked>
            <PasswordForm hasPassword={user.has_password} />
          </Row>
        </Group>
      )}

      <Group title="Session">
        <Row icon={LogOut} title="Log out" description="Sign out on this device.">
          <Button variant="outline" size="lg" className="h-9 px-3.5 text-[14px]" onClick={signOut}>Log out</Button>
        </Row>
      </Group>

      {!user.is_demo && (
        <Group title="Danger zone">
          <Row icon={Trash2} title="Delete account" description="Permanently deletes your meetings, recordings, settings, keys and integrations. This can't be undone.">
            <Button variant="destructive" size="lg" className="h-9 px-3.5 text-[14px]" onClick={() => { setPassword(""); remove.reset(); setDeleting(true); }}>Delete account</Button>
          </Row>
        </Group>
      )}
      {user.is_demo && <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><UserRound className="size-4" /> The demo account can&apos;t be deleted.</p>}

      <ConfirmDialog
        open={deleting} onOpenChange={setDeleting} title="Delete your account?" confirmLabel="Delete everything" pending={remove.isPending}
        description={
          <span className="block space-y-3">
            <span className="block">All of your data is removed immediately.</span>
            {user.has_password && (
              <span className="block space-y-1.5 text-left">
                <label htmlFor="del-pw" className="text-[13px]">Enter your password to confirm</label>
                <input id="del-pw" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
              </span>
            )}
            {error && <span role="alert" className="block text-[13px] text-destructive">{error}</span>}
          </span>
        }
        onConfirm={() => remove.mutate()}
      />
    </SettingsPage>
  );
}
