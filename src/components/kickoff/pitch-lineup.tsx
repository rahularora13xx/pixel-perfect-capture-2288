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

/** Kit-coloured shirt with white sleeves and the jersey number on the chest. */
function Shirt({ color, number }: { color: string; number: number }) {
  return <svg className="pitch-shirt" viewBox="0 0 40 40" aria-hidden="true">
    <polygon className="sleeve" points="13,4 2,9 6,18 11,16" /><polygon className="sleeve" points="27,4 38,9 34,18 29,16" />
    <polygon points="13,4 20,8 27,4 29,16 29,37 11,37 11,16" fill={color} />
    <polygon className="trim" points="13,4 20,8 27,4 38,9 34,18 29,16 29,37 11,37 11,16 6,18 2,9" />
    <text x="20" y="27">{number}</text>
  </svg>;
}

export function PitchLineup({ slug, players, size, color, title }: { slug: string; players: Player[]; size: number; color: string; title: string }) {
  const { starters, bench } = pickStarters(players, size);
  const rows = ORDER.map(pos => starters.filter(p => p.position === pos)).filter(r => r.length);
  const formation = rows.filter(r => r[0]?.position !== "GK").map(r => r.length).join("-");
  return <div>
    <div className="pitch">
      <svg className="pitch-lines" viewBox="0 0 300 400" aria-hidden="true">
        <rect x="12" y="12" width="276" height="376" /><line x1="12" y1="200" x2="288" y2="200" /><circle cx="150" cy="200" r="34" /><circle className="spot" cx="150" cy="200" r="2.5" />
        <rect x="72" y="12" width="156" height="62" /><rect x="114" y="12" width="72" height="24" /><rect x="130" y="2" width="40" height="10" /><path d="M124 74 A 30 30 0 0 0 176 74" />
        <rect x="72" y="326" width="156" height="62" /><rect x="114" y="364" width="72" height="24" /><rect x="130" y="388" width="40" height="10" /><path d="M124 326 A 30 30 0 0 1 176 326" />
        <path d="M12 20 A 8 8 0 0 0 20 12 M280 12 A 8 8 0 0 0 288 20 M12 380 A 8 8 0 0 1 20 388 M280 388 A 8 8 0 0 1 288 380" />
      </svg>
      <span className="pitch-label">{size}-a-side · {title}{formation ? ` · ${formation}` : ""}</span>
      <div className="pitch-rows">
        {rows.map((row, i) => <div key={i} className="pitch-row">
          {row.map(p => <Link key={p.id} to="/t/$slug/player/$playerId" params={{ slug, playerId: p.id }} className="pitch-player">
            <Shirt color={color} number={p.jersey_number} />
            <span className="pitch-name">{p.name}{p.is_captain ? " ©" : ""}</span>
          </Link>)}
        </div>)}
      </div>
    </div>
    {bench.length > 0 && <div className="mt-4"><h3 className="text-xs font-black uppercase text-muted-foreground">Bench</h3><div className="mt-2 flex flex-wrap gap-2">{bench.map(p => <Link key={p.id} to="/t/$slug/player/$playerId" params={{ slug, playerId: p.id }} className="rounded-md border border-border px-3 py-2 text-sm"><b className="mr-2 text-muted-foreground">{p.jersey_number}</b>{p.name} <small className="text-muted-foreground">{p.position}</small></Link>)}</div></div>}
  </div>;
}
