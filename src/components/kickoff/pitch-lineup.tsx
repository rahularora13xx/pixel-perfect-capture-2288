import { Link } from "@tanstack/react-router";
import type { PublicTournament } from "@/lib/kickoff";

type Player = PublicTournament["players"][number];
const ORDER = ["GK", "DEF", "MID", "FWD"] as const;

/** Picks a starting group of `size` players (one GK first) and the rest as bench. */
export function pickStarters(players: Player[], size: number) {
  const sorted = [...players].sort((a, b) => ORDER.indexOf(a.position as never) - ORDER.indexOf(b.position as never) || a.jersey_number - b.jersey_number);
  const gk = sorted.find(p => p.position === "GK");
  const outfield = sorted.filter(p => p !== gk);
  const starters = [...(gk ? [gk] : []), ...outfield.slice(0, size - (gk ? 1 : 0))];
  return { starters, bench: sorted.filter(p => !starters.includes(p)) };
}

export function PitchLineup({ slug, players, size, color, title }: { slug: string; players: Player[]; size: number; color: string; title: string }) {
  const { starters, bench } = pickStarters(players, size);
  const rows = ORDER.map(pos => starters.filter(p => p.position === pos)).filter(r => r.length);
  return <div>
    <div className="pitch">
      <span className="pitch-label">{size}-a-side · {title}</span>
      <div className="pitch-box top" /><div className="pitch-centre" /><div className="pitch-box bottom" />
      <div className="relative z-10 flex h-full flex-col-reverse justify-around py-6">
        {rows.map((row, i) => <div key={i} className="flex justify-around">
          {row.map(p => <Link key={p.id} to="/t/$slug/player/$playerId" params={{ slug, playerId: p.id }} className="pitch-player">
            <span className="pitch-shirt" style={{ backgroundColor: color }}>{p.jersey_number}</span>
            <span className="pitch-name">{p.name}{p.is_captain ? " ©" : ""}</span>
          </Link>)}
        </div>)}
      </div>
    </div>
    {bench.length > 0 && <div className="mt-4"><h3 className="text-xs font-black uppercase text-muted-foreground">Bench</h3><div className="mt-2 flex flex-wrap gap-2">{bench.map(p => <Link key={p.id} to="/t/$slug/player/$playerId" params={{ slug, playerId: p.id }} className="rounded-md border border-border px-3 py-2 text-sm"><b className="mr-2 text-muted-foreground">{p.jersey_number}</b>{p.name} <small className="text-muted-foreground">{p.position}</small></Link>)}</div></div>}
  </div>;
}
