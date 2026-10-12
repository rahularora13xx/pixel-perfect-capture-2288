import type { TournamentDraft } from "./kickoff";

type Player = TournamentDraft["teams"][number]["players"][number];

/** Three-character code from the team name, padded so it always passes the short-name rule. */
export function shortCode(name: string, taken?: string) {
  const code = (name.toUpperCase().replace(/[^A-Z0-9]/g, "") + "XXX").slice(0, 3);
  return code === taken ? `${code.slice(0, 2)}${code[2] === "2" ? "3" : "2"}` : code;
}

/** Squad from typed names (one per line), topped up with placeholders to a full side: keeper first, then defence, midfield and attack. */
export function buildSquad(lines: string, size: number): Player[] {
  const names = lines.split("\n").map(x => x.trim()).filter(x => x.length >= 2).slice(0, size + 7);
  const count = Math.max(size, names.length);
  return Array.from({ length: count }, (_, i) => {
    const spot = (i - 1) / (size - 1);
    const position: Player["position"] = i === 0 ? "GK" : i >= size ? "MID" : spot < 0.4 ? "DEF" : spot < 0.8 ? "MID" : "FWD";
    return { name: (names[i] ?? (i === 0 ? "Goalkeeper" : `Player ${i + 1}`)).slice(0, 80), jerseyNumber: i + 1, position, isCaptain: i === 1 };
  });
}

export type SavedMember = { id: string; name: string; profileId: string | null; jerseyNumber: number; position: string; isCaptain: boolean };

/**
 * Match squad from a saved team, capped at a side plus seven substitutes and topped up with placeholders when the
 * team is short. Always ends with at least one keeper and exactly one captain, which the match rules require.
 */
export function squadFromClub(members: SavedMember[], size: number): Player[] {
  const picked = [...members].sort((a, b) => a.jerseyNumber - b.jerseyNumber).slice(0, size + 7);
  const squad: Player[] = picked.map(m => ({ name: m.name.slice(0, 80), jerseyNumber: m.jerseyNumber, position: (["GK", "DEF", "MID", "FWD"].includes(m.position) ? m.position : "MID") as Player["position"], isCaptain: false, profileId: m.profileId, clubMemberId: m.id }));
  for (let n = 1; squad.length < size && n <= 99; n++) if (!squad.some(p => p.jerseyNumber === n)) squad.push({ name: `Player ${n}`, jerseyNumber: n, position: "MID", isCaptain: false });
  const first = squad[0];
  if (first && !squad.some(p => p.position === "GK")) first.position = "GK";
  const captainId = picked.find(m => m.isCaptain)?.id;
  const captain = squad.find(p => captainId && p.clubMemberId === captainId) ?? first;
  if (captain) captain.isCaptain = true;
  return squad;
}
