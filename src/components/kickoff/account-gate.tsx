import { Link, useLocation } from "@tanstack/react-router";
import { LogIn, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAccount, type Account } from "@/lib/account";

export type ReadyAccount = Extract<Account, { status: "ready" }>;

/** Header shortcut: profile when signed in, sign-in otherwise. Renders nothing until the session is known, so server and client markup match. */
export function AccountLink() {
  const account = useAccount();
  if (account.status === "loading") return null;
  if (account.status === "ready") return <Link to="/me" className="flex items-center gap-2 text-sm font-bold text-foreground"><UserRound className="size-4 text-primary" />{account.profile.display_name}</Link>;
  return <Link to="/login" search={{ next: "/me" }} className="flex items-center gap-2 text-sm font-bold text-primary"><LogIn className="size-4" />Sign in</Link>;
}

/** Shows its children only to a signed-in user with a finished profile; everyone else gets a sign-in prompt that returns here. */
export function RequireAccount({ reason, children }: { reason: string; children: (account: ReadyAccount) => ReactNode }) {
  const account = useAccount(), { pathname } = useLocation();
  if (account.status === "loading") return <p className="mx-auto max-w-xl px-4 py-12 text-muted-foreground">Loading…</p>;
  if (account.status === "ready") return <>{children(account)}</>;
  return <div className="mx-auto max-w-xl px-4 py-12">
    <p className="text-xs font-black uppercase tracking-widest text-primary">Account needed</p>
    <h1 className="mt-1 text-3xl font-black">{account.status === "needs_profile" ? "Finish your profile" : "Sign in to continue"}</h1>
    <p className="mt-3 text-muted-foreground">{reason}</p>
    <Button size="lg" className="mt-6" asChild><Link to="/login" search={{ next: pathname }}><LogIn />{account.status === "needs_profile" ? "Set up profile" : "Sign in"}</Link></Button>
  </div>;
}
