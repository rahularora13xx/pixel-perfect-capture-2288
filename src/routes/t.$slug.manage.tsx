import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, KeyRound, Play, Save, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/kickoff/app-shell";
import { Button } from "@/components/ui/button";
import { CopyButton, ExportButton } from "@/components/kickoff/tournament-view";
import { changeScorerPin, checkOrganiserAccess, getTournament, updateFixture, updateTeam, updateTournamentDetails } from "@/lib/kickoff.functions";
import { rememberTournament, teamFor } from "@/lib/kickoff";

export const Route = createFileRoute("/t/$slug/manage")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : "" }),
  loader: ({ params }) => getTournament({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: [{ title: `Manage ${loaderData?.tournament.name ?? "tournament"} — Kickoff` }, { name: "description", content: "Organiser controls for fixtures, teams, links and exports." }, { property: "og:title", content: "Kickoff organiser controls" }, { property: "og:description", content: "Manage tournament fixtures, teams, scoring and sharing." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Manage,
});
type Data = Awaited<ReturnType<typeof getTournament>>;
function Manage() {
  const data = Route.useLoaderData(), { token } = Route.useSearch(), router = useRouter();
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [error, setError] = useState(""), [section, setSection] = useState("fixtures"), [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false), [name, setName] = useState(data.tournament.name), [venue, setVenue] = useState(data.tournament.venue), [date, setDate] = useState(data.tournament.start_date), [pin, setPin] = useState("");
  const credentials = { tournamentId: data.tournament.id, token };
  useEffect(() => {
    setOrigin(window.location.origin); let active = true; setAccess("checking"); setError("");
    checkOrganiserAccess({ data: { tournamentId: data.tournament.id, token } }).then(result => {
      if (!active) return;
      if (!result.ok) { setError(result.error); setAccess("denied"); return; }
      setAccess("allowed");
      rememberTournament({ slug: data.tournament.public_slug, name: data.tournament.name, organiserUrl: window.location.href, openedAt: new Date().toISOString() });
    }).catch(e => { if (active) { setError(e instanceof Error ? e.message : "Invalid organiser link"); setAccess("denied"); } });
    return () => { active = false; };
  }, [data.tournament.id, token]);
  const save = async (action: () => Promise<unknown>, message: string) => { setBusy(true); try { await action(); await router.invalidate(); toast.success(message); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); } };
  const publicUrl = `${origin}/t/${data.tournament.public_slug}`, organiserUrl = `${publicUrl}/manage?token=${encodeURIComponent(token)}`;
  return <AppShell><main className="mx-auto max-w-3xl px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><Shield className="size-4" />Organiser access</p><h1 className="mt-2 text-3xl font-black">{data.tournament.name}</h1></div><Button variant="outline" asChild><Link to="/t/$slug" params={{ slug: data.tournament.public_slug }}>View public<ExternalLink /></Link></Button></div>
    {access === "checking" && <p className="py-8 text-muted-foreground">Checking organiser link…</p>}
    {access === "denied" && <p role="alert" className="py-8 text-destructive">{error}</p>}
    {access === "allowed" && <>
      <nav className="my-6 flex flex-wrap gap-2">{[["teams", "Edit teams"], ["fixtures", "Edit fixtures"], ["settings", "Edit details"], ["pin", "Change PIN"]].map(([id, label]) => <Button key={id} variant={section === id ? "default" : "outline"} onClick={() => setSection(id ?? "fixtures")}><Settings />{label}</Button>)}</nav>
      {section === "teams" && <section><h2 className="mb-4 text-xl font-black">Teams & squads</h2><div className="space-y-6">{data.teams.map(team => <TeamEditor key={team.id} team={team} players={data.players.filter(p => p.team_id === team.id)} onSave={payload => save(() => updateTeam({ data: { ...payload, ...credentials } }), "Team saved")} busy={busy} />)}</div></section>}
      {section === "fixtures" && <section><h2 className="mb-4 text-xl font-black">Fixtures</h2><div className="space-y-6">{data.matches.map(match => <FixtureEditor key={`${match.id}:${match.scheduled_at}:${match.pitch}:${match.status}`} match={match} data={data} token={token} busy={busy} onSave={payload => save(() => updateFixture({ data: { ...credentials, ...payload } }), "Fixture saved")} />)}</div></section>}
      {section === "settings" && <form className="grid gap-4" onSubmit={e => { e.preventDefault(); void save(() => updateTournamentDetails({ data: { ...credentials, name, venue, startDate: date } }), "Tournament details saved"); }}><h2 className="text-xl font-black">Tournament settings</h2><label className="field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} /></label><label className="field"><span>Venue</span><input value={venue} onChange={e => setVenue(e.target.value)} required minLength={2} maxLength={120} /></label><label className="field"><span>Start date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label><p className="text-sm text-muted-foreground">{data.tournament.team_size}v{data.tournament.team_size} · {data.tournament.half_minutes}-minute halves · {data.tournament.max_subs} substitutions</p><Button type="submit" disabled={busy}><Save />Save details</Button></form>}
      {section === "pin" && <form className="grid max-w-sm gap-4" onSubmit={e => { e.preventDefault(); void save(() => changeScorerPin({ data: { ...credentials, pin } }).then(result => { setPin(""); return result; }), "Scorer PIN changed"); }}><h2 className="text-xl font-black">Scorer PIN</h2><label className="field"><span>New four-digit PIN</span><input type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" required value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} /></label><p className="text-sm text-muted-foreground">Existing scorers will need to unlock scoring again.</p><Button type="submit" disabled={busy || pin.length !== 4}><KeyRound />Change PIN</Button></form>}
      <section className="mt-10 border-t border-border pt-6"><h2 className="font-black">Sharing & export</h2><div className="mt-4 flex flex-wrap gap-2"><CopyButton text={publicUrl} label="Public link" /><CopyButton text={organiserUrl} label="Organiser link" /><ExportButton data={data} /></div></section>
    </>}
  </main></AppShell>;
}
function TeamEditor({ team, players, onSave, busy }: { team: Data["teams"][number]; players: Data["players"]; busy: boolean; onSave: (payload: { teamId: string; name: string; shortName: string; kitColor: string; players: Array<{ id: string; name: string; jerseyNumber: number; position: "GK" | "DEF" | "MID" | "FWD"; isCaptain: boolean }> }) => Promise<void> }) {
  const [name, setName] = useState(team.name), [shortName, setShort] = useState(team.short_name), [kitColor, setColor] = useState(team.kit_color);
  const [squad, setSquad] = useState(players.map(p => ({ id: p.id, name: p.name, jerseyNumber: p.jersey_number, position: p.position as "GK" | "DEF" | "MID" | "FWD", isCaptain: p.is_captain })));
  const change = (id: string, patch: Partial<typeof squad[number]>) => setSquad(rows => rows.map(p => p.id === id ? { ...p, ...patch } : p));
  return <form className="border-b border-border pb-6" onSubmit={e => { e.preventDefault(); void onSave({ teamId: team.id, name, shortName, kitColor, players: squad }); }}>
    <h3 className="mb-3 font-black">{team.name}</h3><div className="grid gap-3 sm:grid-cols-[1fr_110px_80px]"><label className="field"><span>Team name</span><input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label><label className="field"><span>Short name</span><input required pattern="[A-Z0-9]{3}" maxLength={3} value={shortName} onChange={e => setShort(e.target.value.toUpperCase())} /></label><label className="field"><span>Kit colour</span><input aria-label={`Kit colour for ${team.name}`} type="color" value={kitColor} onChange={e => setColor(e.target.value)} /></label></div>
    <div className="mt-4 space-y-3">{squad.map(p => <div key={p.id} className="grid grid-cols-[1fr_68px] gap-2 sm:grid-cols-[1fr_68px_90px_90px]"><input aria-label={`Player name ${p.id}`} required minLength={2} maxLength={80} value={p.name} onChange={e => change(p.id, { name: e.target.value })} /><input aria-label={`Jersey number for ${p.name}`} type="number" required min={0} max={99} value={p.jerseyNumber} onChange={e => change(p.id, { jerseyNumber: +e.target.value })} /><select aria-label={`Position for ${p.name}`} value={p.position} onChange={e => change(p.id, { position: e.target.value as typeof p.position })}>{["GK", "DEF", "MID", "FWD"].map(pos => <option key={pos}>{pos}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="radio" name={`captain-${team.id}`} checked={p.isCaptain} onChange={() => setSquad(rows => rows.map(row => ({ ...row, isCaptain: row.id === p.id })))} />Captain</label></div>)}</div>
    <Button className="mt-4" type="submit" disabled={busy}><Save />Save team</Button>
  </form>;
}
function FixtureEditor({ match, data, token, onSave, busy }: { match: Data["matches"][number]; data: Data; token: string; busy: boolean; onSave: (payload: { matchId: string; homeTeamId: string | null; awayTeamId: string | null; scheduledAt: string; pitch: string }) => Promise<void> }) {
  const localDate = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [home, setHome] = useState(match.home_team_id ?? ""), [away, setAway] = useState(match.away_team_id ?? ""), [date, setDate] = useState(localDate(match.scheduled_at)), [pitch, setPitch] = useState(match.pitch);
  return <form className="border-b border-border pb-6" onSubmit={e => { e.preventDefault(); void onSave({ matchId: match.id, homeTeamId: home || null, awayTeamId: away || null, scheduledAt: new Date(date).toISOString(), pitch }); }}><p className="text-xs font-bold uppercase text-muted-foreground">{match.round_label} · {match.status.replaceAll("_", " ")}</p><h3 className="my-2 font-black">{teamFor(data, match.home_team_id)?.name ?? "TBD"} vs {teamFor(data, match.away_team_id)?.name ?? "TBD"}</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[["Home team", home, setHome], ["Away team", away, setAway]].map(([label, value, setter]) => <label className="field" key={label as string}><span>{label as string}</span><select disabled={match.status !== "scheduled"} value={value as string} onChange={e => (setter as (value: string) => void)(e.target.value)}><option value="">TBD</option>{data.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>)}<label className="field"><span>Kick-off date & time</span><input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></label><label className="field"><span>Pitch</span><input required maxLength={80} value={pitch} onChange={e => setPitch(e.target.value)} /></label></div><div className="mt-4 flex flex-wrap gap-2"><Button type="submit" disabled={busy}><Save />Save fixture</Button><Button variant="outline" asChild><Link to="/t/$slug/match/$matchId" params={{ slug: data.tournament.public_slug, matchId: match.id }} search={{ token }}><Play />{match.status === "scheduled" ? "Start match" : "Open match"}</Link></Button></div></form>;
}
