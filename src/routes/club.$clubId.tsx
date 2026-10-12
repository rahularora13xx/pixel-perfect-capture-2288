import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Play, Star, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadFriends, memberName, nextJersey, POSITIONS, useAccount, type Club, type ClubMember, type Position, type Profile } from "@/lib/account";

export const Route = createFileRoute("/club/$clubId")({
  head: () => ({ meta: [{ title: "Team — Kickoff" }, { name: "description", content: "Squad and players of this team." }, { property: "og:title", content: "Team — Kickoff" }, { property: "og:description", content: "Squad and players of this team." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ClubPage,
});

type Result = PromiseLike<{ error: { message: string; code?: string } | null }>;

function ClubPage() {
  const { clubId } = Route.useParams(), account = useAccount(), navigate = useNavigate();
  const [club, setClub] = useState<Club | null | undefined>(undefined), [members, setMembers] = useState<ClubMember[]>([]), [profiles, setProfiles] = useState(new Map<string, Profile>()), [friends, setFriends] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false), [friendId, setFriendId] = useState(""), [guest, setGuest] = useState("");
  const reload = useCallback(async () => {
    const [{ data: clubRow }, { data: memberRows }] = await Promise.all([supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(), supabase.from("club_members").select("*").eq("club_id", clubId).order("jersey_number")]);
    const ids = (memberRows ?? []).flatMap(m => (m.profile_id ? [m.profile_id] : []));
    const { data: profileRows } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
    setClub(clubRow); setMembers(memberRows ?? []); setProfiles(new Map((profileRows ?? []).map(p => [p.id, p])));
  }, [clubId]);
  useEffect(() => { void reload(); }, [reload]);
  const owner = account.status === "ready" && club?.owner_id === account.userId, userId = account.userId;
  useEffect(() => { if (owner && userId) void loadFriends(userId).then(all => setFriends(all.filter(f => f.state === "friend").map(f => f.profile))).catch(() => setFriends([])); }, [owner, userId]);
  const act = async (action: () => Result, done: string) => {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "That shirt number or player is already in the squad." : error.message); return false; }
    toast.success(done); await reload(); return true;
  };
  if (club === undefined) return <AppShell><p className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</p></AppShell>;
  if (!club) return <AppShell><div className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-black">Team not found</h1></div></AppShell>;
  const taken = members.map(m => m.jersey_number), inSquad = new Set(members.map(m => m.profile_id)), available = friends.filter(f => !inSquad.has(f.id));
  const add = (row: { profile_id?: string; guest_name?: string; position: string; jersey_number?: number | null }, done: string) => act(() => supabase.from("club_members").insert({ club_id: club.id, ...(row.profile_id ? { profile_id: row.profile_id } : {}), ...(row.guest_name ? { guest_name: row.guest_name } : {}), position: row.position, jersey_number: row.jersey_number != null && !taken.includes(row.jersey_number) ? row.jersey_number : nextJersey(taken) }), done);
  const setCaptain = async (member: ClubMember) => {
    // Clear the old captain first so the squad never shows two.
    const previous = members.filter(m => m.is_captain && m.id !== member.id).map(m => m.id);
    if (previous.length && !await act(() => supabase.from("club_members").update({ is_captain: false }).in("id", previous), "Captain cleared")) return;
    await act(() => supabase.from("club_members").update({ is_captain: true }).eq("id", member.id), "Captain updated");
  };
  return <AppShell><div className="mx-auto max-w-3xl px-4 py-10">
    <div className="flex flex-wrap items-center gap-5">
      <span className="size-20 rounded-full border-4 border-card" style={{ backgroundColor: club.kit_color }} />
      <div className="flex-1"><p className="text-xs font-bold uppercase text-primary">Permanent team · {club.short_name}</p><h1 className="text-4xl font-black">{club.name}</h1><p className="mt-1 text-sm text-muted-foreground">{members.length} player{members.length === 1 ? "" : "s"}</p></div>
      {owner && <Button asChild><Link to="/quick-match" search={{ club: club.id }}><Play />Start a match</Link></Button>}
    </div>
    <h2 className="mt-10 text-xl font-black">Squad</h2>
    <div className="mt-3 divide-y divide-border">{members.map(m => { const profile = m.profile_id ? profiles.get(m.profile_id) : undefined; return <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
      {owner ? <input aria-label={`Shirt number for ${memberName(m, profiles)}`} className="w-16" type="number" min={0} max={99} defaultValue={m.jersey_number} disabled={busy} onBlur={e => { const n = Math.floor(+e.target.value); if (n !== m.jersey_number && n >= 0 && n <= 99) void act(() => supabase.from("club_members").update({ jersey_number: n }).eq("id", m.id), "Shirt number saved"); }} /> : <b className="w-7 text-muted-foreground">{m.jersey_number}</b>}
      <div className="min-w-0 flex-1">{profile ? <Link to="/u/$username" params={{ username: profile.username }} className="font-bold">{profile.display_name}</Link> : <span className="font-bold">{m.guest_name}</span>}{m.is_captain && <Star className="ml-2 inline size-3 text-primary" aria-label="Captain" />}<p className="text-xs text-muted-foreground">{profile ? `@${profile.username}` : "Guest · no account yet"}</p></div>
      {owner ? <>
        <select aria-label={`Position for ${memberName(m, profiles)}`} value={m.position} disabled={busy} onChange={e => act(() => supabase.from("club_members").update({ position: e.target.value as Position }).eq("id", m.id), "Position saved")}>{POSITIONS.map(p => <option key={p}>{p}</option>)}</select>
        {!profile && available.length > 0 && <select aria-label={`Link ${m.guest_name ?? "guest"} to a friend`} value="" disabled={busy} onChange={e => { const id = e.target.value; if (id) void act(() => supabase.from("club_members").update({ profile_id: id, guest_name: null }).eq("id", m.id), "Guest linked to profile"); }}><option value="">Link to friend…</option>{available.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}</select>}
        {!m.is_captain && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCaptain(m)}>Make captain</Button>}
        <Button size="icon" variant="ghost" aria-label={`Remove ${memberName(m, profiles)}`} disabled={busy} onClick={() => { if (window.confirm(`Remove ${memberName(m, profiles)} from ${club.name}?`)) void act(() => supabase.from("club_members").delete().eq("id", m.id), "Player removed"); }}><Trash2 /></Button>
      </> : <small>{m.position}</small>}
    </div>; })}</div>
    {owner && <section className="mt-8 wizard-panel grid gap-4">
      <h3 className="font-black">Add players</h3>
      <form className="grid grid-cols-[1fr_auto] items-end gap-2" onSubmit={e => { e.preventDefault(); const friend = friends.find(f => f.id === friendId); if (friend) void add({ profile_id: friend.id, position: friend.position, jersey_number: friend.jersey_number }, "Friend added to squad").then(ok => { if (ok) setFriendId(""); }); }}>
        <label className="field"><span>From your friends</span><select value={friendId} onChange={e => setFriendId(e.target.value)}><option value="">{available.length ? "Choose a friend" : "No friends left to add"}</option>{available.map(f => <option key={f.id} value={f.id}>{f.display_name} (@{f.username})</option>)}</select></label>
        <Button type="submit" disabled={busy || !friendId}><UserPlus />Add</Button>
      </form>
      <form className="grid grid-cols-[1fr_auto] items-end gap-2" onSubmit={e => { e.preventDefault(); void add({ guest_name: guest.trim(), position: "MID" }, "Guest added to squad").then(ok => { if (ok) setGuest(""); }); }}>
        <label className="field"><span>Someone without an account</span><input minLength={2} maxLength={80} value={guest} onChange={e => setGuest(e.target.value)} placeholder="Player name" /></label>
        <Button type="submit" variant="outline" disabled={busy || guest.trim().length < 2}><UserPlus />Add guest</Button>
      </form>
      <p className="text-sm text-muted-foreground">When a guest signs up and becomes your friend, use “Link to friend” on their row. The matches they already played then count on their profile.</p>
      <Button variant="destructive" className="justify-self-start" disabled={busy} onClick={async () => { if (!window.confirm(`Delete ${club.name} permanently? Past match results are kept.`)) return; const { error } = await supabase.from("clubs").delete().eq("id", club.id); if (error) { toast.error(error.message); return; } toast.success("Team deleted"); void navigate({ to: "/me" }); }}><Trash2 />Delete team</Button>
    </section>}
  </div></AppShell>;
}
