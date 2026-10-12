-- Accounts: player profiles, friendships and permanent teams ("clubs"), plus links from
-- tournament rows back to them so career stats follow a player across matches.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  position text NOT NULL DEFAULT 'MID' CHECK (position IN ('GK','DEF','MID','FWD')),
  jersey_number smallint CHECK (jersey_number BETWEEN 0 AND 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users edit their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendships_pair_key ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
-- Only the status column is updatable, so accepting a request can never rewrite who it is between.
GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT UPDATE (status) ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People see their own friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester_id, addressee_id));
CREATE POLICY "People send their own requests" ON public.friendships FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "Only the invited person accepts" ON public.friendships FOR UPDATE TO authenticated USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid() AND status = 'accepted');
CREATE POLICY "Either side can remove a friendship" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() IN (requester_id, addressee_id));

CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships f WHERE f.status = 'accepted' AND ((f.requester_id = a AND f.addressee_id = b) OR (f.requester_id = b AND f.addressee_id = a)));
$$;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  short_name text NOT NULL CHECK (short_name ~ '^[A-Z0-9]{3}$'),
  kit_color text NOT NULL CHECK (kit_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clubs_owner_id_idx ON public.clubs (owner_id);
GRANT SELECT ON public.clubs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clubs are public" ON public.clubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners create clubs" ON public.clubs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners edit clubs" ON public.clubs FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete clubs" ON public.clubs FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A member is either a registered profile or a guest known only by name; the owner can link a guest to a friend later.
CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_name text CHECK (char_length(guest_name) BETWEEN 2 AND 80),
  jersey_number smallint NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
  position text NOT NULL DEFAULT 'MID' CHECK (position IN ('GK','DEF','MID','FWD')),
  is_captain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (profile_id IS NOT NULL OR guest_name IS NOT NULL),
  UNIQUE (club_id, profile_id), UNIQUE (club_id, jersey_number)
);
CREATE INDEX club_members_profile_id_idx ON public.club_members (profile_id);
GRANT SELECT ON public.club_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT ALL ON public.club_members TO service_role;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members are public" ON public.club_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners add themselves, friends or guests" ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
    AND (profile_id IS NULL OR profile_id = auth.uid() OR public.are_friends(auth.uid(), profile_id)));
CREATE POLICY "Owners edit members" ON public.club_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid())
    AND (profile_id IS NULL OR profile_id = auth.uid() OR public.are_friends(auth.uid(), profile_id)));
CREATE POLICY "Owners remove members and members can leave" ON public.club_members FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tournaments_owner_id_idx ON public.tournaments (owner_id);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS club_member_id uuid REFERENCES public.club_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS players_profile_id_idx ON public.players (profile_id);
CREATE INDEX IF NOT EXISTS players_club_member_id_idx ON public.players (club_member_id);
