import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { RequireAccount, type ReadyAccount } from "@/components/kickoff/account-gate";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { memberName, type Club } from "@/lib/account";
import { createTournament } from "@/lib/kickoff.functions";
import { rememberTournament, shareOrigin, type TournamentDraft } from "@/lib/kickoff";
import { buildSquad, shortCode, squadFromClub, type SavedMember } from "@/lib/quick-match";

export const Route = createFileRoute("/quick-match")({
  validateSearch: (s: Record<string, unknown>) => (typeof s["club"] === "string" ? { club: s["club"] } : {}),
  head: () => ({ meta: [{ title: "One-off match — Kickoff" }, { name: "description", content: "Set up and score a single football match in under a minute." }, { property: "og:title", content: "Score a one-off match — Kickoff" }, { property: "og:description", content: "Two teams, one link, live score." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <AppShell><RequireAccount reason="Sign in so the match is saved to your account and counts towards your players' stats.">{account => <QuickMatchPage account={account} />}</RequireAccount></AppShell>,
});

type Side = { name: string; kitColor: string; squad: string; saved: { clubId: string; members: SavedMember[] } | null };

async function loadSavedTeam(club: Club): Promise<Side> {
  const { data: members, error } = await supabase.from("club_members").select("*").eq("club_id", club.id);
  if (error) throw new Error(error.message);
  const ids = (members ?? []).flatMap(m => (m.profile_id ? [m.profile_id] : []));
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map(p => [p.id, p]));
  return { name: club.name, kitColor: club.kit_color, squad: "", saved: { clubId: club.id, members: (members ?? []).map(m => ({ id: m.id, name: memberName(m, byId), profileId: m.profile_id, jerseyNumber: m.jersey_number, position: m.position, isCaptain: m.is_captain })) } };
}

function QuickMatchPage({ account }: { account: ReadyAccount }) {
  const nav = useNavigate(), { club: preselected } = Route.useSearch();
  const [home, setHome] = useState<Side>({ name: "", kitColor: "#FF5A36", squad: "", saved: null }), [away, setAway] = useState<Side>({ name: "", kitColor: "#60A5FA", squad: "", saved: null });
  const [venue, setVenue] = useState(""), [kickoff, setKickoff] = useState(""), [teamSize, setTeamSize] = useState(7), [halfMinutes, setHalfMinutes] = useState(20), [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [clubs, setClubs] = useState<Club[]>([]);
  useEffect(() => { const d = new Date(); setKickoff(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }, []);
  useEffect(() => {
    let active = true;
    void supabase.from("clubs").select("*").eq("owner_id", account.userId).order("name").then(async ({ data }) => {
      if (!active) return;
      setClubs(data ?? []);
      const chosen = (data ?? []).find(c => c.id === preselected);
      if (chosen) { const side = await loadSavedTeam(chosen).catch(() => null); if (active && side) setHome(side); }
    });
    return () => { active = false; };
  }, [account.userId, preselected]);
  const pick = async (clubId: string, set: (side: Side) => void) => {
    const chosen = clubs.find(c => c.id === clubId);
    if (!chosen) return;
    try { set(await loadSavedTeam(chosen)); } catch (e) { setError(e instanceof Error ? e.message : "Could not load that team"); }
  };
  const ready = home.name.trim().length >= 2 && away.name.trim().length >= 2 && venue.trim().length >= 2 && pin.length === 4 && !!kickoff;
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const homeCode = shortCode(home.name);
      const draft: TournamentDraft = {
        name: `${home.name.trim()} vs ${away.name.trim()}`.slice(0, 80), venue, startDate: kickoff.slice(0, 10), kickoffAt: new Date(kickoff).toISOString(), scorerPin: pin,
        teamSize, maxSubs: 5, halfMinutes, extraTimeEnabled: false, extraTimeHalfMinutes: 5, penaltiesEnabled: false,
        format: "round_robin", roundRobinLegs: 1, seeding: "manual", groupCount: 1, advanceCount: 2,
        teams: [home, away].map((side, i) => ({ name: side.name.trim(), shortName: i === 0 ? homeCode : shortCode(side.name, homeCode), kitColor: side.kitColor, clubId: side.saved?.clubId ?? null, players: side.saved ? squadFromClub(side.saved.members, teamSize) : buildSquad(side.squad, teamSize) })),
      };
      const result = await createTournament({ data: draft });
      const publicUrl = `${shareOrigin()}/t/${result.slug}`, organiserUrl = `${publicUrl}/manage?token=${encodeURIComponent(result.token)}`;
      rememberTournament({ slug: result.slug, name: result.name, organiserUrl, openedAt: new Date().toISOString() });
      sessionStorage.setItem(`kickoff:new:${result.slug}`, JSON.stringify({ organiserUrl, publicUrl, ...(result.matchId ? { matchId: result.matchId } : {}) }));
      void nav({ to: "/t/$slug/created", params: { slug: result.slug } });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the match"); } finally { setBusy(false); }
  };
  const sides = [["Home team", home, setHome, away], ["Away team", away, setAway, home]] as const;
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <p className="text-xs font-black uppercase tracking-widest text-primary">One-off match</p>
    <h1 className="mt-1 text-3xl font-black">Two teams. One match.</h1>
    <p className="mt-2 text-muted-foreground">No tournament needed. You get a live score link to share and a private link to score from.</p>
    <form className="mt-6 grid gap-5" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-4 md:grid-cols-2">{sides.map(([label, side, set, other]) => <div key={label} className="wizard-panel grid content-start gap-4">
        {clubs.length > 0 && <label className="field"><span>Use one of my teams</span><select value={side.saved?.clubId ?? ""} onChange={e => { if (e.target.value) void pick(e.target.value, set); else set({ ...side, saved: null }); }}><option value="">Type a team instead</option>{clubs.map(c => <option key={c.id} value={c.id} disabled={other.saved?.clubId === c.id}>{c.name}</option>)}</select></label>}
        <div className="grid grid-cols-[1fr_4rem] gap-2"><label className="field"><span>{label}</span><input required minLength={2} maxLength={60} value={side.name} onChange={e => set({ ...side, name: e.target.value })} placeholder="Team name" /></label><label className="field"><span>Kit</span><input aria-label={`${label} kit colour`} type="color" value={side.kitColor} onChange={e => set({ ...side, kitColor: e.target.value })} /></label></div>
        {side.saved ? <div><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{side.saved.members.length} saved player{side.saved.members.length === 1 ? "" : "s"}</p><Button type="button" size="sm" variant="ghost" onClick={() => set({ ...side, saved: null })}><X />Type names instead</Button></div><p className="mt-1 text-sm text-muted-foreground">{[...side.saved.members].sort((a, b) => a.jerseyNumber - b.jerseyNumber).map(m => `${m.jerseyNumber} ${m.name}`).join(" · ")}</p>{side.saved.members.length < teamSize && <p className="mt-2 text-xs text-warning">Fewer than {teamSize} players, so the rest are filled in as placeholders.</p>}</div>
          : <label className="field"><span>Players <small className="font-normal text-muted-foreground">optional · one per line · keeper first</small></span><textarea className="min-h-32 rounded-md border border-border bg-card p-3 text-sm" value={side.squad} onChange={e => set({ ...side, squad: e.target.value })} placeholder={"Keeper\nPlayer two\nPlayer three"} /></label>}
      </div>)}</div>
      <div className="wizard-panel grid gap-4 sm:grid-cols-2">
        <label className="field"><span>Venue / ground</span><input required minLength={2} maxLength={120} value={venue} onChange={e => setVenue(e.target.value)} placeholder="Riverside Sports Ground" /></label>
        <label className="field"><span>Kick-off</span><input required type="datetime-local" value={kickoff} onChange={e => setKickoff(e.target.value)} /></label>
        <label className="field"><span>Players per side</span><select value={teamSize} onChange={e => setTeamSize(+e.target.value)}>{[5, 6, 7, 8, 9, 10, 11].map(n => <option key={n} value={n}>{n}-a-side</option>)}</select></label>
        <label className="field"><span>Minutes per half</span><input required type="number" min={5} max={60} value={halfMinutes} onChange={e => setHalfMinutes(+e.target.value)} /></label>
        <label className="field"><span>4-digit scorer PIN</span><input required inputMode="numeric" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" /></label>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || !ready}><Check />{busy ? "Creating…" : "Create match"}</Button>
      <p className="text-sm text-muted-foreground">Missing players are filled in as “Player 2”, “Player 3”… and can be renamed later from the organiser link.</p>
    </form>
  </div>;
}
