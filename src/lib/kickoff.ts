export type TournamentDraft = {
  name: string; venue: string; startDate: string; scorerPin: string;
  teamSize: number; maxSubs: 3 | 5 | 7; halfMinutes: number;
  extraTimeEnabled: boolean; extraTimeHalfMinutes: number; penaltiesEnabled: boolean;
  format: "round_robin" | "knockout" | "hybrid"; roundRobinLegs: 1 | 2;
  seeding: "random" | "manual"; groupCount: 1 | 2; advanceCount: 2 | 4;
  /** Kick-off of the first fixture; used by one-off matches, which start at a chosen time rather than 09:00. */
  kickoffAt?: string;
  teams: Array<{ name: string; shortName: string; kitColor: string; clubId?: string | null; players: Array<{ name: string; jerseyNumber: number; position: "GK" | "DEF" | "MID" | "FWD"; isCaptain: boolean; profileId?: string | null; clubMemberId?: string | null }> }>;
};

export type PublicTournament = {
  tournament: { id: string; public_slug: string; name: string; venue: string; start_date: string; team_size: number; max_subs: number; half_minutes: number; extra_time_enabled: boolean; penalties_enabled: boolean; format: string };
  teams: Array<{ id: string; tournament_id: string; name: string; short_name: string; kit_color: string; seed: number; group_name: string | null }>;
  players: Array<{ id: string; tournament_id: string; team_id: string; name: string; jersey_number: number; position: string; is_captain: boolean }>;
  matches: Array<{ id: string; tournament_id: string; home_team_id: string | null; away_team_id: string | null; round_label: string; round_number: number; scheduled_at: string; pitch: string; status: string; home_score: number; away_score: number; home_penalties: number; away_penalties: number; player_of_match_id: string | null }>;
  events: Array<{ id: string; match_id: string; team_id: string; player_id: string | null; related_player_id: string | null; event_type: string; minute: number; stoppage_minute: number | null; is_penalty: boolean; created_at: string }>;
};

export type RememberedTournament = { slug: string; name: string; organiserUrl?: string; openedAt: string };
const KEY = "kickoff:tournaments";

export function getRemembered(): RememberedTournament[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RememberedTournament[]; } catch { return []; }
}
export function rememberTournament(item: RememberedTournament) {
  if (typeof window === "undefined") return;
  const previous = getRemembered().find(x => x.slug === item.slug);
  const retained = !item.organiserUrl && previous?.organiserUrl ? { ...item, organiserUrl: previous.organiserUrl } : item;
  const next = [retained, ...getRemembered().filter((x) => x.slug !== item.slug)].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(next));
}
/** A one-off match is stored as a two-team, single-fixture tournament. */
export function isSingleMatch(data: { teams: unknown[]; matches: unknown[] }) { return data.teams.length === 2 && data.matches.length === 1; }
export function teamFor(data: PublicTournament, id: string | null) { return data.teams.find((team) => team.id === id); }
export function playerFor(data: PublicTournament, id: string | null) { return data.players.find((player) => player.id === id); }
export function statusLabel(status: string) {
  return ({ scheduled: "Scheduled", first_half: "LIVE", half_time: "HT", second_half: "LIVE", et_first_half: "ET", et_half_time: "ET HT", et_second_half: "ET", penalties: "PENS", full_time: "FT" } as Record<string,string>)[status] ?? status;
}
export function standings(data: PublicTournament) {
  return data.teams.map((team) => {
    const games = data.matches.filter((m) => m.status === "full_time" && (m.home_team_id === team.id || m.away_team_id === team.id));
    let w=0,d=0,l=0,gf=0,ga=0;
    games.forEach((m) => { const home=m.home_team_id===team.id; const f=home?m.home_score:m.away_score; const a=home?m.away_score:m.home_score; gf+=f; ga+=a; if(f>a)w++; else if(f<a)l++; else d++; });
    return { team, p: games.length, w,d,l,gf,ga,gd:gf-ga,pts:w*3+d };
  }).sort((a,b)=>b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
}
export function playerStats(data: PublicTournament) {
  return data.players.map((player) => {
    const events=data.events.filter((e)=>e.player_id===player.id);
    const assists=data.events.filter((e)=>e.related_player_id===player.id && e.event_type==="goal").length;
    return { player, goals:events.filter((e)=>e.event_type==="goal").length, assists, yellow:events.filter((e)=>e.event_type==="yellow"||e.event_type==="second_yellow").length, red:events.filter((e)=>e.event_type==="red"||e.event_type==="second_yellow").length, potm:data.matches.filter((m)=>m.player_of_match_id===player.id).length };
  });
}
export const PUBLISHED_ORIGIN = "https://kickoffscorer.lovable.app";
/** Preview hosts need a Lovable login, so shared links always point at the published app from there. */
export function shareOrigin() {
  if (typeof window === "undefined") return PUBLISHED_ORIGIN;
  const host = window.location.hostname;
  return host.includes("id-preview--") || host.endsWith("lovableproject.com") || host === "localhost" ? PUBLISHED_ORIGIN : window.location.origin;
}
export function forgetTournament(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(getRemembered().filter(x => x.slug !== slug)));
}
