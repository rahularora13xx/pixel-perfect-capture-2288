import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { careerStats, useAccount, type CareerStats, type Club, type Profile } from "@/lib/account";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Kickoff` }, { name: "description", content: "Player profile, teams and career stats." }, { property: "og:title", content: `@${params.username} — Kickoff` }, { property: "og:description", content: "Player profile, teams and career stats." }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams(), account = useAccount();
  const [state, setState] = useState<"loading" | "missing" | "ready">("loading"), [profile, setProfile] = useState<Profile | null>(null), [stats, setStats] = useState<CareerStats | null>(null), [clubs, setClubs] = useState<Club[]>([]), [requested, setRequested] = useState(false);
  useEffect(() => {
    let active = true; setState("loading");
    void (async () => {
      const { data: found } = await supabase.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
      if (!active) return;
      if (!found) { setState("missing"); return; }
      setProfile(found); setState("ready");
      const [career, memberships] = await Promise.all([careerStats(found.id).catch(() => null), supabase.from("club_members").select("club_id").eq("profile_id", found.id)]);
      const ids = (memberships.data ?? []).map(m => m.club_id);
      const { data: clubRows } = ids.length ? await supabase.from("clubs").select("*").in("id", ids).order("name") : { data: [] };
      if (active) { setStats(career); setClubs(clubRows ?? []); }
    })();
    return () => { active = false; };
  }, [username]);
  const addFriend = async () => {
    if (account.status !== "ready" || !profile) return;
    const { error } = await supabase.from("friendships").insert({ requester_id: account.userId, addressee_id: profile.id });
    if (error && error.code !== "23505") { toast.error(error.message); return; }
    setRequested(true); toast.success(error ? "You are already connected" : "Friend request sent");
  };
  if (state === "loading") return <AppShell><p className="mx-auto max-w-2xl px-4 py-10 text-muted-foreground">Loading…</p></AppShell>;
  if (state === "missing" || !profile) return <AppShell><div className="mx-auto max-w-2xl px-4 py-10"><h1 className="text-3xl font-black">Player not found</h1><p className="mt-2 text-muted-foreground">No profile uses the username @{username}.</p></div></AppShell>;
  const own = account.status === "ready" && account.userId === profile.id;
  const tiles: Array<[string, number]> = stats ? [["Matches", stats.matches], ["Goals", stats.goals], ["Assists", stats.assists], ["Goal contributions", stats.goals + stats.assists], ["Yellow cards", stats.yellow], ["Red cards", stats.red]] : [];
  return <AppShell><div className="mx-auto max-w-2xl px-4 py-10">
    <div className="flex flex-wrap items-center gap-5">
      <span className="grid size-20 place-items-center rounded-full bg-primary text-2xl font-black text-primary-foreground">{profile.jersey_number ?? profile.display_name.slice(0, 1).toUpperCase()}</span>
      <div className="flex-1"><p className="text-xs font-bold uppercase text-primary">@{profile.username} · {profile.position}</p><h1 className="text-4xl font-black">{profile.display_name}</h1></div>
      {own ? <Button variant="outline" asChild><Link to="/me">Edit profile</Link></Button> : account.status === "ready" && <Button disabled={requested} onClick={addFriend}><UserPlus />{requested ? "Request sent" : "Add friend"}</Button>}
    </div>
    <h2 className="mt-10 text-xl font-black">Career</h2>
    {stats ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{tiles.map(([label, value]) => <div className="stat-tile" key={label}><b>{value}</b><span>{label}</span></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Loading stats…</p>}
    <h2 className="mt-10 text-xl font-black">Teams</h2>
    {clubs.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{clubs.map(c => <Link key={c.id} to="/club/$clubId" params={{ clubId: c.id }} className="team-card"><span className="size-10 rounded-full border-4 border-card shadow" style={{ backgroundColor: c.kit_color }} /><div className="flex-1"><h3>{c.name}</h3><p>{c.owner_id === profile.id ? "Manager" : "Player"}</p></div></Link>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Not in a team yet.</p>}
  </div></AppShell>;
}
