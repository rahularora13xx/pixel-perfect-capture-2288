import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Club = Tables["clubs"]["Row"];
export type ClubMember = Tables["club_members"]["Row"];
export type Position = "GK" | "DEF" | "MID" | "FWD";
export const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export type Account =
  | { status: "loading" | "signed_out"; userId: null; email: null; profile: null }
  | { status: "needs_profile"; userId: string; email: string | null; profile: null }
  | { status: "ready"; userId: string; email: string | null; profile: Profile };

const SIGNED_OUT: Account = { status: "signed_out", userId: null, email: null, profile: null };

/** Current sign-in state plus the player profile, kept in step with Supabase auth events. */
export function useAccount(): Account & { refresh: () => Promise<void> } {
  const [account, setAccount] = useState<Account>({ status: "loading", userId: null, email: null, profile: null });
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) { setAccount(SIGNED_OUT); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setAccount(profile ? { status: "ready", userId: user.id, email: user.email ?? null, profile } : { status: "needs_profile", userId: user.id, email: user.email ?? null, profile: null });
  }, []);
  useEffect(() => {
    void refresh();
    // Deferred: Supabase holds a lock while this callback runs, so querying inside it would deadlock.
    const { data } = supabase.auth.onAuthStateChange(() => { setTimeout(() => void refresh(), 0); });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  return { ...account, refresh };
}

/** Only same-site paths are accepted as a post-sign-in destination. */
export function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/me";
}

const loginRedirect = (next: string) => `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
export async function signInWithEmail(email: string, next: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: loginRedirect(next) } });
  if (error) throw new Error(error.message);
}
export async function signInWithGoogle(next: string) {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: loginRedirect(next) } });
  if (error) throw new Error(error.message);
}
export async function signOut() { await supabase.auth.signOut(); }

export type Friend = { friendshipId: string; profile: Profile; state: "friend" | "incoming" | "outgoing" };

/** Every friendship involving the user, with the other person's profile attached. */
export async function loadFriends(userId: string): Promise<Friend[]> {
  const { data: rows, error } = await supabase.from("friendships").select("id,requester_id,addressee_id,status");
  if (error) throw new Error(error.message);
  const otherIds = (rows ?? []).map(r => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  if (!otherIds.length) return [];
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").in("id", otherIds);
  if (profileError) throw new Error(profileError.message);
  const byId = new Map((profiles ?? []).map(p => [p.id, p]));
  return (rows ?? []).flatMap(r => {
    const profile = byId.get(r.requester_id === userId ? r.addressee_id : r.requester_id);
    if (!profile) return [];
    const state: Friend["state"] = r.status === "accepted" ? "friend" : r.requester_id === userId ? "outgoing" : "incoming";
    return [{ friendshipId: r.id, profile, state }];
  }).sort((a, b) => a.profile.display_name.localeCompare(b.profile.display_name));
}

export async function searchProfiles(query: string, excludeId: string) {
  const term = query.trim().toLowerCase().replace(/[^a-z0-9_ ]/g, "");
  if (term.length < 2) return [];
  const { data, error } = await supabase.from("profiles").select("*").or(`username.ilike.${term.replace(/ /g, "_")}%,display_name.ilike.%${term}%`).neq("id", excludeId).limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function memberName(member: ClubMember, profiles: Map<string, Profile>) {
  return (member.profile_id ? profiles.get(member.profile_id)?.display_name : null) ?? member.guest_name ?? "Player";
}

/** Lowest shirt number not yet used in a squad. */
export function nextJersey(taken: number[]) {
  for (let n = 1; n <= 99; n++) if (!taken.includes(n)) return n;
  return 0;
}

export type CareerStats = { matches: number; goals: number; assists: number; yellow: number; red: number };

/**
 * Totals across every tournament and one-off match the profile was fielded in. Squad rows are matched by
 * profile or by club membership, so matches played as a guest count once the owner links that guest to the profile.
 */
export async function careerStats(profileId: string): Promise<CareerStats> {
  const empty = { matches: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
  const { data: memberships } = await supabase.from("club_members").select("id").eq("profile_id", profileId);
  const memberIds = (memberships ?? []).map(m => m.id);
  const filter = memberIds.length ? `profile_id.eq.${profileId},club_member_id.in.(${memberIds.join(",")})` : `profile_id.eq.${profileId}`;
  const { data: players, error } = await supabase.from("players").select("id,team_id").or(filter);
  if (error) throw new Error(error.message);
  if (!players?.length) return empty;
  const playerIds = players.map(p => p.id), teamIds = [...new Set(players.map(p => p.team_id))];
  const [own, assisted, home, away] = await Promise.all([
    supabase.from("match_events").select("event_type").in("player_id", playerIds),
    supabase.from("match_events").select("id", { count: "exact", head: true }).in("related_player_id", playerIds).eq("event_type", "goal"),
    supabase.from("matches").select("id").eq("status", "full_time").in("home_team_id", teamIds),
    supabase.from("matches").select("id").eq("status", "full_time").in("away_team_id", teamIds),
  ]);
  const count = (...types: string[]) => (own.data ?? []).filter(e => types.includes(e.event_type)).length;
  return { matches: new Set([...(home.data ?? []), ...(away.data ?? [])].map(m => m.id)).size, goals: count("goal"), assists: assisted.count ?? 0, yellow: count("yellow", "second_yellow"), red: count("red", "second_yellow") };
}
