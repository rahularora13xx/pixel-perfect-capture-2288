import { randomUUID } from "node:crypto";

export type Fixture = {
  id?: string;
  tournament_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  round_number: number;
  round_label: string;
  stage: "league" | "group" | "round_of_16" | "quarter_final" | "semi_final" | "final";
  scheduled_at: string;
  pitch: string;
  next_match_id?: string | null;
  next_match_slot?: "home" | "away" | null;
};

export function knockoutFixtures(tournamentId: string, ids: Array<string | null>, base: Date, offset = 0): Fixture[] {
  const size = 2 ** Math.ceil(Math.log2(ids.length));
  const all: Fixture[][] = [];
  for (let r = 0; r < Math.log2(size); r++) {
    const count = size / (2 ** (r + 1));
    const stage = count === 1 ? "final" : count === 2 ? "semi_final" : count === 4 ? "quarter_final" : "round_of_16";
    all.push(Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      tournament_id: tournamentId,
      home_team_id: r === 0 ? ids[i] || null : null,
      away_team_id: r === 0 ? ids[size - 1 - i] || null : null,
      round_number: r + 1,
      round_label: stage.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
      stage,
      scheduled_at: new Date(base.getTime() + (offset + r * 4 + i) * 3600000).toISOString(),
      pitch: `Pitch ${(i % 2) + 1}`,
    })));
  }
  for (let r = 0; r < all.length - 1; r++) {
    all[r]?.forEach((match, i) => {
      match.next_match_id = all[r + 1]?.[Math.floor(i / 2)]?.id ?? null;
      match.next_match_slot = i % 2 === 0 ? "home" : "away";
    });
  }
  return all.flat();
}