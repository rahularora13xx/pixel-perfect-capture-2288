import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { POSITIONS, safeNext, signInWithEmail, signInWithGoogle, useAccount, USERNAME_PATTERN, type Position } from "@/lib/account";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({ meta: [{ title: "Sign in — Kickoff" }, { name: "description", content: "Sign in to create matches, build your team and track your stats." }, { property: "og:title", content: "Sign in — Kickoff" }, { property: "og:description", content: "Your profile, friends, teams and career stats." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LoginPage,
});

function LoginPage() {
  const account = useAccount(), { next } = Route.useSearch(), navigate = useNavigate();
  useEffect(() => { if (account.status === "ready") void navigate({ href: next, replace: true }); }, [account.status, next, navigate]);
  return <AppShell><div className="mx-auto max-w-md px-4 py-12">
    {(account.status === "loading" || account.status === "ready") && <p className="text-muted-foreground">Loading…</p>}
    {account.status === "signed_out" && <SignIn next={next} />}
    {account.status === "needs_profile" && <ProfileSetup userId={account.userId} email={account.email} onDone={account.refresh} />}
  </div></AppShell>;
}

function SignIn({ next }: { next: string }) {
  const [email, setEmail] = useState(""), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const attempt = async (action: () => Promise<void>, done?: () => void) => { setBusy(true); setError(""); try { await action(); done?.(); } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in"); } finally { setBusy(false); } };
  if (sent) return <div><Mail className="size-10 text-primary" /><h1 className="mt-4 text-3xl font-black">Check your inbox</h1><p className="mt-3 text-muted-foreground">We sent a sign-in link to <b className="text-foreground">{email}</b>. Open it on this device to finish signing in.</p><Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Use a different email</Button></div>;
  return <div>
    <p className="text-xs font-black uppercase tracking-widest text-primary">Your account</p>
    <h1 className="mt-1 text-3xl font-black">Sign in</h1>
    <p className="mt-3 text-muted-foreground">One profile for your teams, friends and career stats. No password needed.</p>
    <Button size="lg" variant="outline" className="mt-6 w-full" disabled={busy} onClick={() => attempt(() => signInWithGoogle(next))}>Continue with Google</Button>
    <p className="my-4 text-center text-xs font-bold uppercase text-muted-foreground">or</p>
    <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void attempt(() => signInWithEmail(email, next), () => setSent(true)); }}>
      <label className="field"><span>Email</span><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <Button size="lg" type="submit" disabled={busy || !email}><Mail />{busy ? "Sending…" : "Email me a sign-in link"}</Button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </div>;
}

function ProfileSetup({ userId, email, onDone }: { userId: string; email: string | null; onDone: () => Promise<void> }) {
  const [username, setUsername] = useState(""), [displayName, setDisplayName] = useState(""), [position, setPosition] = useState<Position>("MID"), [jersey, setJersey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError("");
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId, username, display_name: displayName.trim(), position, jersey_number: jersey === "" ? null : +jersey });
    setBusy(false);
    if (insertError) { setError(insertError.code === "23505" ? "That username is taken. Try another." : insertError.message); return; }
    await onDone();
  };
  return <form onSubmit={e => { e.preventDefault(); void submit(); }}>
    <UserRound className="size-10 text-primary" />
    <h1 className="mt-4 text-3xl font-black">Set up your profile</h1>
    <p className="mt-3 text-muted-foreground">{email ? <>Signed in as <b className="text-foreground">{email}</b>. </> : null}Friends find you by your username.</p>
    <div className="mt-6 grid gap-4">
      <label className="field"><span>Username</span><input required minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="rahul_10" /></label>
      <label className="field"><span>Name shown on team sheets</span><input required minLength={2} maxLength={60} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Rahul Arora" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="field"><span>Position</span><select value={position} onChange={e => setPosition(e.target.value as Position)}>{POSITIONS.map(p => <option key={p}>{p}</option>)}</select></label><label className="field"><span>Shirt number</span><input type="number" min={0} max={99} value={jersey} onChange={e => setJersey(e.target.value)} placeholder="Optional" /></label></div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <Button size="lg" type="submit" className="mt-6 w-full" disabled={busy || !USERNAME_PATTERN.test(username) || displayName.trim().length < 2}>{busy ? "Saving…" : "Create profile"}</Button>
  </form>;
}
