import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Plus, Save, Search, Shield, Trophy, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequireAccount, type ReadyAccount } from "@/components/kickoff/account-gate";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadFriends, POSITIONS, searchProfiles, signOut, useAccount, type Club, type Friend, type Position, type Profile } from "@/lib/account";
import { reissueOrganiserLink } from "@/lib/kickoff.functions";
import { shortCode } from "@/lib/quick-match";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "My profile — Kickoff" }, { name: "description", content: "Your profile, friends, teams and matches." }, { property: "og:title", content: "My profile — Kickoff" }, { property: "og:description", content: "Your profile, friends, teams and matches." }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <AppShell><RequireAccount reason="Sign in to see your profile, friends and teams.">{account => <MePage account={account} />}</RequireAccount></AppShell>,
});

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function MePage({ account }: { account: ReadyAccount }) {
  const { refresh } = useAccount(), navigate = useNavigate();
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-widest text-primary">@{account.profile.username}</p><h1 className="mt-1 text-3xl font-black">{account.profile.display_name}</h1></div>
      <div className="flex gap-2"><Button variant="outline" asChild><Link to="/u/$username" params={{ username: account.profile.username }}>Public profile</Link></Button><Button variant="ghost" onClick={async () => { await signOut(); void navigate({ to: "/" }); }}><LogOut />Sign out</Button></div>
    </div>
    <ProfileForm profile={account.profile} onSaved={refresh} />
    <Clubs account={account} />
    <Friends userId={account.userId} />
    <MyMatches userId={account.userId} />
  </div>;
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(profile.display_name), [position, setPosition] = useState(profile.position as Position), [jersey, setJersey] = useState(profile.jersey_number?.toString() ?? ""), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim(), position, jersey_number: jersey === "" ? null : +jersey }).eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved"); await onSaved();
  };
  return <form className="mt-6 wizard-panel grid gap-4 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end" onSubmit={e => { e.preventDefault(); void save(); }}>
    <label className="field"><span>Name on team sheets</span><input required minLength={2} maxLength={60} value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
    <label className="field"><span>Position</span><select value={position} onChange={e => setPosition(e.target.value as Position)}>{POSITIONS.map(p => <option key={p}>{p}</option>)}</select></label>
    <label className="field"><span>Shirt no.</span><input type="number" min={0} max={99} value={jersey} onChange={e => setJersey(e.target.value)} /></label>
    <Button type="submit" disabled={busy || displayName.trim().length < 2}><Save />Save</Button>
  </form>;
}

function Clubs({ account }: { account: ReadyAccount }) {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]), [name, setName] = useState(""), [kitColor, setKitColor] = useState("#FF5A36"), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: memberships } = await supabase.from("club_members").select("club_id").eq("profile_id", account.userId);
      const ids = (memberships ?? []).map(m => m.club_id);
      const { data } = await supabase.from("clubs").select("*").or(ids.length ? `owner_id.eq.${account.userId},id.in.(${ids.join(",")})` : `owner_id.eq.${account.userId}`).order("name");
      if (active) setClubs(data ?? []);
    })();
    return () => { active = false; };
  }, [account.userId]);
  const create = async () => {
    setBusy(true);
    try {
      const { data: club, error } = await supabase.from("clubs").insert({ owner_id: account.userId, name: name.trim(), short_name: shortCode(name), kit_color: kitColor }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: memberError } = await supabase.from("club_members").insert({ club_id: club.id, profile_id: account.userId, jersey_number: account.profile.jersey_number ?? 1, position: account.profile.position, is_captain: true });
      if (memberError) throw new Error(memberError.message);
      void navigate({ to: "/club/$clubId", params: { clubId: club.id } });
    } catch (e) { toast.error(message(e, "Could not create the team")); } finally { setBusy(false); }
  };
  return <section className="mt-10">
    <h2 className="flex items-center gap-2 text-xl font-black"><Shield className="size-5 text-primary" />My teams</h2>
    <p className="mt-1 text-sm text-muted-foreground">Permanent teams keep their squad, so you can start a match without retyping names.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{clubs.map(c => <Link key={c.id} to="/club/$clubId" params={{ clubId: c.id }} className="team-card"><span className="size-10 rounded-full border-4 border-card shadow" style={{ backgroundColor: c.kit_color }} /><div className="flex-1"><h3>{c.name}</h3><p>{c.owner_id === account.userId ? "You manage this team" : "You play for this team"}</p></div></Link>)}</div>
    <form className="mt-4 grid grid-cols-[1fr_4rem_auto] items-end gap-2" onSubmit={e => { e.preventDefault(); void create(); }}>
      <label className="field"><span>New team name</span><input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunday Strikers" /></label>
      <label className="field"><span>Kit</span><input aria-label="Kit colour" type="color" value={kitColor} onChange={e => setKitColor(e.target.value)} /></label>
      <Button type="submit" disabled={busy || name.trim().length < 2}><Plus />Create</Button>
    </form>
  </section>;
}

function Friends({ userId }: { userId: string }) {
  const [friends, setFriends] = useState<Friend[]>([]), [query, setQuery] = useState(""), [results, setResults] = useState<Profile[]>([]), [busy, setBusy] = useState(false);
  const reload = useCallback(async () => { try { setFriends(await loadFriends(userId)); } catch (e) { toast.error(message(e, "Could not load friends")); } }, [userId]);
  useEffect(() => { void reload(); }, [reload]);
  const act = async (action: () => PromiseLike<{ error: { message: string; code?: string } | null }>, done: string) => {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "You are already connected with this player." : error.message); return; }
    toast.success(done); await reload();
  };
  const search = async () => { setBusy(true); try { setResults(await searchProfiles(query, userId)); } catch (e) { toast.error(message(e, "Search failed")); } finally { setBusy(false); } };
  const known = new Set(friends.map(f => f.profile.id));
  const groups: Array<[string, Friend["state"]]> = [["Requests for you", "incoming"], ["Friends", "friend"], ["Sent requests", "outgoing"]];
  return <section className="mt-10">
    <h2 className="flex items-center gap-2 text-xl font-black"><Users className="size-5 text-primary" />Friends</h2>
    <form className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2" onSubmit={e => { e.preventDefault(); void search(); }}>
      <label className="field"><span>Find players by username or name</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. khush_7" /></label>
      <Button type="submit" variant="outline" disabled={busy || query.trim().length < 2}><Search />Search</Button>
    </form>
    {results.length > 0 && <div className="mt-3 divide-y divide-border rounded-md border border-border">{results.map(p => <div key={p.id} className="flex items-center gap-3 p-3"><div className="flex-1"><b>{p.display_name}</b><p className="text-xs text-muted-foreground">@{p.username} · {p.position}</p></div>{known.has(p.id) ? <span className="text-xs text-muted-foreground">Already connected</span> : <Button size="sm" disabled={busy} onClick={() => act(() => supabase.from("friendships").insert({ requester_id: userId, addressee_id: p.id }), "Friend request sent")}><UserPlus />Add friend</Button>}</div>)}</div>}
    {groups.map(([title, state]) => { const rows = friends.filter(f => f.state === state); return rows.length ? <div key={state} className="mt-5"><h3 className="text-xs font-black uppercase text-muted-foreground">{title}</h3><div className="mt-2 divide-y divide-border">{rows.map(f => <div key={f.friendshipId} className="flex items-center gap-3 py-3"><Link to="/u/$username" params={{ username: f.profile.username }} className="flex-1"><b>{f.profile.display_name}</b><p className="text-xs text-muted-foreground">@{f.profile.username} · {f.profile.position}</p></Link>{state === "incoming" && <Button size="sm" disabled={busy} onClick={() => act(() => supabase.from("friendships").update({ status: "accepted" }).eq("id", f.friendshipId), "Friend added")}>Accept</Button>}<Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => supabase.from("friendships").delete().eq("id", f.friendshipId), state === "friend" ? "Friend removed" : "Request removed")}>{state === "incoming" ? "Decline" : state === "friend" ? "Remove" : "Cancel"}</Button></div>)}</div></div> : null; })}
    {!friends.length && <p className="mt-4 text-sm text-muted-foreground">No friends yet. Search for a teammate to send a request.</p>}
  </section>;
}

function MyMatches({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<{ id: string; public_slug: string; name: string; start_date: string }>>([]), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; void supabase.from("tournaments").select("id,public_slug,name,start_date").eq("owner_id", userId).order("start_date", { ascending: false }).then(({ data }) => { if (active) setRows(data ?? []); }); return () => { active = false; }; }, [userId]);
  const manage = async (row: (typeof rows)[number]) => {
    if (!window.confirm(`Create a new organiser link for "${row.name}"? Any organiser link you shared before will stop working.`)) return;
    setBusy(true);
    try {
      const result = await reissueOrganiserLink({ data: { tournamentId: row.id } });
      if (!result.ok) { toast.error(result.error); return; }
      void navigate({ to: "/t/$slug/manage", params: { slug: result.slug }, search: { token: result.token } });
    } catch (e) { toast.error(message(e, "Could not create a new link")); } finally { setBusy(false); }
  };
  return <section className="mt-10">
    <h2 className="flex items-center gap-2 text-xl font-black"><Trophy className="size-5 text-primary" />My matches & tournaments</h2>
    {rows.length ? <div className="mt-3 divide-y divide-border">{rows.map(r => <div key={r.id} className="flex items-center gap-3 py-3"><Link to="/t/$slug" params={{ slug: r.public_slug }} className="flex-1"><b>{r.name}</b><p className="text-xs text-muted-foreground">{new Date(`${r.start_date}T12:00:00`).toLocaleDateString()}</p></Link><Button size="sm" variant="outline" disabled={busy} onClick={() => manage(r)}><KeyRound />Manage</Button></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nothing yet. <Link to="/quick-match" className="font-bold text-primary">Start a one-off match</Link> or <Link to="/create" className="font-bold text-primary">create a tournament</Link>.</p>}
  </section>;
}
