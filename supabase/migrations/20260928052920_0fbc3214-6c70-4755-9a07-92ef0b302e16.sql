CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  venue text NOT NULL CHECK (char_length(venue) BETWEEN 2 AND 120),
  start_date date NOT NULL,
  team_size smallint NOT NULL CHECK (team_size BETWEEN 5 AND 11),
  max_subs smallint NOT NULL CHECK (max_subs IN (3,5,7)),
  half_minutes smallint NOT NULL DEFAULT 20 CHECK (half_minutes BETWEEN 5 AND 60),
  extra_time_enabled boolean NOT NULL DEFAULT true,
  extra_time_half_minutes smallint NOT NULL DEFAULT 5 CHECK (extra_time_half_minutes BETWEEN 1 AND 15),
  penalties_enabled boolean NOT NULL DEFAULT true,
  format text NOT NULL CHECK (format IN ('round_robin','knockout','hybrid')),
  round_robin_legs smallint NOT NULL DEFAULT 1 CHECK (round_robin_legs IN (1,2)),
  seeding text NOT NULL DEFAULT 'random' CHECK (seeding IN ('random','manual')),
  group_count smallint NOT NULL DEFAULT 1 CHECK (group_count IN (1,2)),
  advance_count smallint NOT NULL DEFAULT 4 CHECK (advance_count IN (2,4)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public tournaments are viewable" ON public.tournaments FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.tournament_secrets (
  tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  edit_token_hash text NOT NULL,
  scorer_pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tournament_secrets TO service_role;
ALTER TABLE public.tournament_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  short_name text NOT NULL CHECK (short_name ~ '^[A-Z0-9]{3}$'),
  kit_color text NOT NULL CHECK (kit_color ~ '^#[0-9A-Fa-f]{6}$'),
  seed smallint NOT NULL,
  group_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, short_name), UNIQUE(tournament_id, seed)
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public teams are viewable" ON public.teams FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  jersey_number smallint NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
  position text NOT NULL CHECK (position IN ('GK','DEF','MID','FWD')),
  is_captain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, jersey_number)
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public players are viewable" ON public.players FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  winner_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  round_number smallint NOT NULL DEFAULT 1,
  round_label text NOT NULL DEFAULT 'Round 1',
  stage text NOT NULL DEFAULT 'league' CHECK (stage IN ('league','group','round_of_16','quarter_final','semi_final','final')),
  scheduled_at timestamptz NOT NULL,
  pitch text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','first_half','half_time','second_half','et_first_half','et_half_time','et_second_half','penalties','full_time')),
  clock_started_at timestamptz,
  clock_elapsed_seconds integer NOT NULL DEFAULT 0 CHECK (clock_elapsed_seconds >= 0),
  clock_running boolean NOT NULL DEFAULT false,
  home_score smallint NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score smallint NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  home_penalties smallint NOT NULL DEFAULT 0 CHECK (home_penalties >= 0),
  away_penalties smallint NOT NULL DEFAULT 0 CHECK (away_penalties >= 0),
  player_of_match_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  next_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  next_match_slot text CHECK (next_match_slot IN ('home','away')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public matches are viewable" ON public.matches FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('starter','bench')),
  is_goalkeeper boolean NOT NULL DEFAULT false,
  UNIQUE(match_id, player_id)
);
GRANT SELECT ON public.lineups TO anon, authenticated;
GRANT ALL ON public.lineups TO service_role;
ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public lineups are viewable" ON public.lineups FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  related_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('goal','own_goal','yellow','second_yellow','red','substitution')),
  minute smallint NOT NULL CHECK (minute BETWEEN 0 AND 180),
  stoppage_minute smallint CHECK (stoppage_minute BETWEEN 1 AND 30),
  is_penalty boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public events are viewable" ON public.match_events FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.shootout_kicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  kick_order smallint NOT NULL CHECK (kick_order > 0),
  result text NOT NULL CHECK (result IN ('scored','missed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, kick_order)
);
GRANT SELECT ON public.shootout_kicks TO anon, authenticated;
GRANT ALL ON public.shootout_kicks TO service_role;
ALTER TABLE public.shootout_kicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public kicks are viewable" ON public.shootout_kicks FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.scorer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scorer_sessions TO service_role;
ALTER TABLE public.scorer_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.pin_attempts TO service_role;
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX pin_attempts_lookup_idx ON public.pin_attempts(tournament_id, attempt_key, attempted_at DESC);
CREATE INDEX matches_tournament_schedule_idx ON public.matches(tournament_id, scheduled_at);
CREATE INDEX events_match_created_idx ON public.match_events(match_id, created_at);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.match_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shootout_kicks;

WITH t AS (
  INSERT INTO public.tournaments (public_slug,name,venue,start_date,team_size,max_subs,half_minutes,format,round_robin_legs,extra_time_enabled,penalties_enabled)
  VALUES ('campus-cup-26','Campus Cup 2026','Riverside Sports Ground','2026-10-03',7,5,20,'hybrid',1,true,true)
  RETURNING id
), a AS (
  INSERT INTO public.teams (tournament_id,name,short_name,kit_color,seed,group_name)
  SELECT id,'Falcons','FAL','#FF5A36',1,'Group A' FROM t RETURNING id,tournament_id
), b AS (
  INSERT INTO public.teams (tournament_id,name,short_name,kit_color,seed,group_name)
  SELECT id,'Rovers','ROV','#34D399',2,'Group A' FROM t RETURNING id,tournament_id
), c AS (
  INSERT INTO public.teams (tournament_id,name,short_name,kit_color,seed,group_name)
  SELECT id,'United','UTD','#60A5FA',3,'Group A' FROM t RETURNING id,tournament_id
), d AS (
  INSERT INTO public.teams (tournament_id,name,short_name,kit_color,seed,group_name)
  SELECT id,'Athletic','ATH','#FBBF24',4,'Group A' FROM t RETURNING id,tournament_id
), players_a AS (
  INSERT INTO public.players (tournament_id,team_id,name,jersey_number,position,is_captain)
  SELECT a.tournament_id,a.id,v.name,v.num,v.pos,v.cap FROM a CROSS JOIN (VALUES ('Leo Martin',1,'GK',false),('Sam Carter',4,'DEF',true),('Noah Singh',6,'MID',false),('Jamie Cole',7,'MID',false),('Owen Price',9,'FWD',false),('Max Doyle',10,'FWD',false),('Eli Brooks',11,'DEF',false),('Ryan Bell',14,'MID',false)) v(name,num,pos,cap) RETURNING id
), players_b AS (
  INSERT INTO public.players (tournament_id,team_id,name,jersey_number,position,is_captain)
  SELECT b.tournament_id,b.id,v.name,v.num,v.pos,v.cap FROM b CROSS JOIN (VALUES ('Ari Shah',1,'GK',false),('Ben Young',3,'DEF',true),('Kai Evans',5,'DEF',false),('Tom Reed',7,'MID',false),('Luke Hall',9,'FWD',false),('Finn Ward',10,'MID',false),('Adam Khan',12,'FWD',false)) v(name,num,pos,cap) RETURNING id
)
INSERT INTO public.matches (tournament_id,home_team_id,away_team_id,round_number,round_label,stage,scheduled_at,pitch,status,home_score,away_score)
SELECT t.id,a.id,b.id,1,'Matchday 1','league','2026-10-03 09:00:00+00'::timestamptz,'Pitch 1','full_time',2::smallint,1::smallint FROM t,a,b
UNION ALL SELECT t.id,c.id,d.id,1,'Matchday 1','league','2026-10-03 10:00:00+00'::timestamptz,'Pitch 1','scheduled',0::smallint,0::smallint FROM t,c,d
UNION ALL SELECT t.id,a.id,c.id,2,'Matchday 2','league','2026-10-03 12:00:00+00'::timestamptz,'Pitch 2','scheduled',0::smallint,0::smallint FROM t,a,c
UNION ALL SELECT t.id,b.id,d.id,2,'Matchday 2','league','2026-10-03 13:00:00+00'::timestamptz,'Pitch 2','scheduled',0::smallint,0::smallint FROM t,b,d;

INSERT INTO public.tournament_secrets (tournament_id,edit_token_hash,scorer_pin_hash)
SELECT id, encode(digest('demo-organiser-token','sha256'),'hex'), encode(digest('2468:' || id::text,'sha256'),'hex') FROM public.tournaments WHERE public_slug='campus-cup-26';

WITH m AS (SELECT id,tournament_id,home_team_id,away_team_id FROM public.matches WHERE status='full_time' LIMIT 1), hp AS (SELECT p.id,p.team_id FROM public.players p JOIN m ON p.team_id=m.home_team_id ORDER BY p.jersey_number LIMIT 1), hp2 AS (SELECT p.id,p.team_id FROM public.players p JOIN m ON p.team_id=m.home_team_id ORDER BY p.jersey_number OFFSET 4 LIMIT 1), ap AS (SELECT p.id,p.team_id FROM public.players p JOIN m ON p.team_id=m.away_team_id ORDER BY p.jersey_number OFFSET 4 LIMIT 1)
INSERT INTO public.match_events(tournament_id,match_id,team_id,player_id,event_type,minute)
SELECT m.tournament_id,m.id,hp2.team_id,hp2.id,'goal',8 FROM m,hp2
UNION ALL SELECT m.tournament_id,m.id,ap.team_id,ap.id,'goal',14 FROM m,ap
UNION ALL SELECT m.tournament_id,m.id,hp2.team_id,hp2.id,'goal',31 FROM m,hp2;