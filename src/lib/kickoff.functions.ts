import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { clockPatch } from "./match-controls";
import { knockoutFixtures, type Fixture } from "./knockout-fixtures";
import type { Database } from "@/integrations/supabase/types";

const playerSchema = z.object({ name:z.string().trim().min(2).max(80), jerseyNumber:z.number().int().min(0).max(99), position:z.enum(["GK","DEF","MID","FWD"]), isCaptain:z.boolean() });
const teamSchema = z.object({ name:z.string().trim().min(2).max(60), shortName:z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/), kitColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/), players:z.array(playerSchema).min(5).max(18) });
const draftSchema = z.object({ name:z.string().trim().min(2).max(80), venue:z.string().trim().min(2).max(120), startDate:z.string().date(), scorerPin:z.string().regex(/^\d{4}$/), teamSize:z.number().int().min(5).max(11), maxSubs:z.union([z.literal(3),z.literal(5),z.literal(7)]), halfMinutes:z.number().int().min(5).max(60), extraTimeEnabled:z.boolean(), extraTimeHalfMinutes:z.number().int().min(1).max(15), penaltiesEnabled:z.boolean(), format:z.enum(["round_robin","knockout","hybrid"]), roundRobinLegs:z.union([z.literal(1),z.literal(2)]), seeding:z.enum(["random","manual"]), groupCount:z.union([z.literal(1),z.literal(2)]), advanceCount:z.union([z.literal(2),z.literal(4)]), teams:z.array(teamSchema).min(4).max(10) }).superRefine((d,ctx)=>d.teams.forEach((t,i)=>{if(t.players.length<d.teamSize||t.players.length>d.teamSize+7)ctx.addIssue({code:"custom",path:["teams",i,"players"],message:`Squad must have ${d.teamSize}–${d.teamSize+7} players`});if(!t.players.some(p=>p.position==="GK"))ctx.addIssue({code:"custom",path:["teams",i,"players"],message:"Add at least one goalkeeper"});if(t.players.filter(p=>p.isCaptain).length!==1)ctx.addIssue({code:"custom",path:["teams",i,"players"],message:"Choose exactly one captain"})}));
const slugSchema=z.string().regex(/^[a-z0-9-]{6,40}$/);
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const safeEqual=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
function publicClient(){const key=process.env['SUPABASE_PUBLISHABLE_KEY']!;return createClient<Database>(process.env['SUPABASE_URL']!,key,{auth:{storage:undefined,persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith("sb_")&&headers.get("Authorization")===`Bearer ${key}`)headers.delete("Authorization");headers.set("apikey",key);return fetch(input,{...init,headers});}}})}

export const getTournament=createServerFn({method:"GET"}).inputValidator((d)=>z.object({slug:slugSchema}).parse(d)).handler(async({data})=>{
  const db=publicClient();
  const {data:t,error}=await db.from("tournaments").select("id,public_slug,name,venue,start_date,team_size,max_subs,half_minutes,extra_time_enabled,penalties_enabled,format").eq("public_slug",data.slug).maybeSingle();
  if(error)throw new Error(error.message);if(!t)throw new Error("Tournament not found");
  const [teams,players,matches,events,lineups,kicks]=await Promise.all([
    db.from("teams").select("id,tournament_id,name,short_name,kit_color,seed,group_name").eq("tournament_id",t.id).order("seed"),
    db.from("players").select("id,tournament_id,team_id,name,jersey_number,position,is_captain").eq("tournament_id",t.id).order("jersey_number"),
    db.from("matches").select("id,tournament_id,home_team_id,away_team_id,round_label,round_number,stage,scheduled_at,pitch,status,clock_started_at,clock_elapsed_seconds,clock_running,home_score,away_score,home_penalties,away_penalties,player_of_match_id,next_match_id,next_match_slot").eq("tournament_id",t.id).order("scheduled_at"),
    db.from("match_events").select("id,match_id,team_id,player_id,related_player_id,event_type,minute,stoppage_minute,is_penalty,created_at").eq("tournament_id",t.id).order("created_at"),
    db.from("lineups").select("id,match_id,team_id,player_id,role,is_goalkeeper").eq("tournament_id",t.id),
    db.from("shootout_kicks").select("id,match_id,team_id,player_id,kick_order,result").eq("tournament_id",t.id).order("kick_order")
  ]);
  for(const result of [teams,players,matches,events,lineups,kicks])if(result.error)throw new Error(result.error.message);
  return {tournament:t,teams:teams.data??[],players:players.data??[],matches:matches.data??[],events:events.data??[],lineups:lineups.data??[],kicks:kicks.data??[]};
});

function rounds(ids:string[],legs:number){const rotating=[...ids];if(rotating.length%2)rotating.push("");const out:Array<[string,string,number]>=[];for(let round=0;round<rotating.length-1;round++){for(let i=0;i<rotating.length/2;i++){const a=rotating[i],b=rotating[rotating.length-1-i];if(a&&b)out.push(round%2?[b,a,round+1]:[a,b,round+1]);}rotating.splice(1,0,rotating.pop()??"");}if(legs===2){const first=[...out];first.forEach(([a,b,r])=>out.push([b,a,r+rotating.length-1]));}return out;}

export const createTournament=createServerFn({method:"POST"}).inputValidator((d)=>draftSchema.parse(d)).handler(async({data})=>{
  const token=randomBytes(32).toString("base64url"),slug=randomBytes(7).toString("hex");const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:t,error}=await supabaseAdmin.from("tournaments").insert({public_slug:slug,name:data.name,venue:data.venue,start_date:data.startDate,team_size:data.teamSize,max_subs:data.maxSubs,half_minutes:data.halfMinutes,extra_time_enabled:data.extraTimeEnabled,extra_time_half_minutes:data.extraTimeHalfMinutes,penalties_enabled:data.penaltiesEnabled,format:data.format,round_robin_legs:data.roundRobinLegs,seeding:data.seeding,group_count:data.groupCount,advance_count:data.advanceCount}).select("id,public_slug,name").single();if(error)throw new Error(error.message);
  const {error:secretError}=await supabaseAdmin.from("tournament_secrets").insert({tournament_id:t.id,edit_token_hash:hash(token),scorer_pin_hash:hash(`${data.scorerPin}:${t.id}`)});if(secretError)throw new Error(secretError.message);
  const {data:teams,error:teamError}=await supabaseAdmin.from("teams").insert(data.teams.map((team,i)=>({tournament_id:t.id,name:team.name,short_name:team.shortName,kit_color:team.kitColor,seed:i+1,group_name:data.format==="hybrid"&&data.groupCount===2?(i%2?"Group B":"Group A"):null}))).select("id,seed,group_name");if(teamError)throw new Error(teamError.message);
  const bySeed=new Map((teams??[]).map(team=>[team.seed,team.id]));const playerRows=data.teams.flatMap((team,i)=>team.players.map(player=>({tournament_id:t.id,team_id:bySeed.get(i+1)??"",name:player.name,jersey_number:player.jerseyNumber,position:player.position,is_captain:player.isCaptain})));const {error:playerError}=await supabaseAdmin.from("players").insert(playerRows);if(playerError)throw new Error(playerError.message);
  const sorted=(teams??[]).sort((a,b)=>a.seed-b.seed),ids=sorted.map(team=>team.id),base=new Date(`${data.startDate}T09:00:00Z`);let fixtures:Fixture[]=[];
  if(data.format==="knockout")fixtures=knockoutFixtures(t.id,ids,base);
  else {const groups=data.format==="hybrid"&&data.groupCount===2?[sorted.filter(t=>t.group_name==="Group A"),sorted.filter(t=>t.group_name==="Group B")]:[sorted];let index=0;for(const group of groups){for(const [home,away,round] of rounds(group.map(t=>t.id),data.roundRobinLegs)){fixtures.push({id:randomUUID(),tournament_id:t.id,home_team_id:home,away_team_id:away,round_number:round,round_label:groups.length===2?`${group[0]?.group_name} · Matchday ${round}`:`Matchday ${round}`,stage:groups.length===2?"group":"league",scheduled_at:new Date(base.getTime()+index++*3600000).toISOString(),pitch:`Pitch ${(index%2)+1}`});}}if(data.format==="hybrid")fixtures.push(...knockoutFixtures(t.id,Array.from({length:data.advanceCount},()=>null),base,index+2));}
  if(fixtures.length){const {error:matchError}=await supabaseAdmin.from("matches").insert(fixtures);if(matchError)throw new Error(matchError.message)}return {slug:t.public_slug,name:t.name,token};
});

async function verifyCredential(tournamentId:string,credential:string,kind:"organiser"|"session",admin:any){const {data:secret}=await admin.from("tournament_secrets").select("edit_token_hash").eq("tournament_id",tournamentId).single();if(kind==="organiser")return !!secret&&safeEqual(hash(credential),secret.edit_token_hash);const {data:session}=await admin.from("scorer_sessions").select("id").eq("tournament_id",tournamentId).eq("token_hash",hash(credential)).gt("expires_at",new Date().toISOString()).maybeSingle();return !!session;}
export const unlockScoring=createServerFn({method:"POST"}).inputValidator((d)=>z.object({matchId:z.string().uuid(),pin:z.string().max(200)}).parse(d)).handler(async({data})=>{if(!/^\d{4}$/.test(data.pin))return {ok:false as const,error:"Enter a four-digit scorer PIN"};const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data:match}=await supabaseAdmin.from("matches").select("tournament_id").eq("id",data.matchId).single();if(!match)return {ok:false as const,error:"Match not found"};const attemptKey=hash(`${match.tournament_id}:scorer`);const since=new Date(Date.now()-15*60000).toISOString();const {count}=await supabaseAdmin.from("pin_attempts").select("id",{count:"exact",head:true}).eq("tournament_id",match.tournament_id).eq("attempt_key",attemptKey).eq("succeeded",false).gte("attempted_at",since);if((count??0)>=5)return {ok:false as const,error:"Too many incorrect attempts. Try again in 15 minutes."};const {data:secret}=await supabaseAdmin.from("tournament_secrets").select("scorer_pin_hash").eq("tournament_id",match.tournament_id).single();const valid=!!secret&&safeEqual(hash(`${data.pin}:${match.tournament_id}`),secret.scorer_pin_hash);await supabaseAdmin.from("pin_attempts").insert({tournament_id:match.tournament_id,attempt_key:attemptKey,succeeded:valid});if(!valid)return {ok:false as const,error:"Incorrect scorer PIN"};const token=randomBytes(32).toString("base64url");const {error}=await supabaseAdmin.from("scorer_sessions").insert({tournament_id:match.tournament_id,token_hash:hash(token),expires_at:new Date(Date.now()+12*3600000).toISOString()});if(error)throw new Error(error.message);return {ok:true as const,token};});
const credentialSchema=z.object({matchId:z.string().uuid(),credential:z.string().min(16).max(200),kind:z.enum(["organiser","session"])});
const scoreSchema=credentialSchema.extend({teamId:z.string().uuid(),playerId:z.string().uuid().nullable(),relatedPlayerId:z.string().uuid().nullable().optional(),eventType:z.enum(["goal","own_goal","yellow","red","second_yellow","substitution"]),minute:z.number().int().min(0).max(180),isPenalty:z.boolean().optional()});
export const addMatchEvent=createServerFn({method:"POST"}).inputValidator((d)=>scoreSchema.parse(d)).handler(async({data})=>{const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data:match}=await supabaseAdmin.from("matches").select("tournament_id,home_team_id,away_team_id,home_score,away_score").eq("id",data.matchId).single();if(!match)throw new Error("Match not found");if(data.teamId!==match.home_team_id&&data.teamId!==match.away_team_id)throw new Error("That team is not in this match");if(!await verifyCredential(match.tournament_id,data.credential,data.kind,supabaseAdmin))throw new Error("Scoring access expired or invalid");if(data.playerId){const {data:player}=await supabaseAdmin.from("players").select("id").eq("id",data.playerId).eq("team_id",data.teamId).eq("tournament_id",match.tournament_id).maybeSingle();if(!player)throw new Error("Choose a player from this team");}if(data.relatedPlayerId&&data.eventType==="goal"){if(data.relatedPlayerId===data.playerId)throw new Error("The assist must come from a different player");const {data:assister}=await supabaseAdmin.from("players").select("id").eq("id",data.relatedPlayerId).eq("team_id",data.teamId).eq("tournament_id",match.tournament_id).maybeSingle();if(!assister)throw new Error("Choose an assist from the scoring team");}let eventType=data.eventType;if(eventType==="yellow"&&data.playerId){const {count}=await supabaseAdmin.from("match_events").select("id",{count:"exact",head:true}).eq("match_id",data.matchId).eq("player_id",data.playerId).in("event_type",["yellow","second_yellow"]);if((count??0)>0)eventType="second_yellow";}const {error}=await supabaseAdmin.from("match_events").insert({tournament_id:match.tournament_id,match_id:data.matchId,team_id:data.teamId,player_id:data.playerId,related_player_id:data.relatedPlayerId??null,event_type:eventType,minute:data.minute,is_penalty:data.isPenalty??false});if(error)throw new Error(error.message);if(eventType==="goal"||eventType==="own_goal"){const teamIsHome=data.teamId===match.home_team_id;const homeScores=eventType==="own_goal"?!teamIsHome:teamIsHome;const {error:updateError}=await supabaseAdmin.from("matches").update(homeScores?{home_score:match.home_score+1}:{away_score:match.away_score+1}).eq("id",data.matchId);if(updateError)throw new Error(updateError.message)}return {ok:true};});
export const controlMatch=createServerFn({method:"POST"}).inputValidator((d)=>credentialSchema.extend({action:z.enum(["start_first","half_time","start_second","pause","resume","full_time","undo","correct_clock"]),elapsedSeconds:z.number().int().min(0).max(10800).optional()}).parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:match,error:readError}=await supabaseAdmin.from("matches").select("*").eq("id",data.matchId).single();
  if(readError||!match)throw new Error("Match not found");
  if(!await verifyCredential(match.tournament_id,data.credential,data.kind,supabaseAdmin))throw new Error("Scoring access expired or invalid");
  if(data.action==="undo"){
    const {data:event,error}=await supabaseAdmin.from("match_events").select("id,event_type,team_id").eq("match_id",data.matchId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(error)throw new Error(error.message);
    if(!event)throw new Error("No event to undo");
    const {error:deleteError}=await supabaseAdmin.from("match_events").delete().eq("id",event.id);if(deleteError)throw new Error(deleteError.message);
    const {data:goals,error:goalError}=await supabaseAdmin.from("match_events").select("team_id,event_type").eq("match_id",data.matchId).in("event_type",["goal","own_goal"]);if(goalError)throw new Error(goalError.message);
    let home=0,away=0;for(const e of goals??[]){if((e.team_id===match.home_team_id)===(e.event_type==="goal"))home++;else away++;}
    const {error:updateError}=await supabaseAdmin.from("matches").update({home_score:home,away_score:away}).eq("id",match.id);if(updateError)throw new Error(updateError.message);
    return {ok:true};
  }
  if(!match.home_team_id||!match.away_team_id)throw new Error("Both teams must be assigned before starting this match.");
  const {data:t,error:tError}=await supabaseAdmin.from("tournaments").select("half_minutes").eq("id",match.tournament_id).single();if(tError||!t)throw new Error("Tournament not found");
  const patch=clockPatch(match,data.action,t.half_minutes,Date.now(),data.elapsedSeconds);
  const {error,data:changed}=await supabaseAdmin.from("matches").update(patch).eq("id",match.id).eq("updated_at",match.updated_at).select("id").maybeSingle();if(error)throw new Error(error.message);if(!changed)throw new Error("Match changed on another device. Refresh and try again.");
  return {ok:true};
});

const organiserSchema=z.object({tournamentId:z.string().uuid(),token:z.string().min(16).max(200)});
export const checkOrganiserAccess=createServerFn({method:"POST"}).inputValidator((d)=>z.object({tournamentId:z.string().uuid(),token:z.string()}).parse(d)).handler(async({data})=>{
  const invalid = {ok:false as const,error:"Invalid organiser link. Open the original private link to manage this tournament."};
  if(data.token.length<16||data.token.length>200)return invalid;
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))return invalid;
  return {ok:true as const};
});
export const updateTeam=createServerFn({method:"POST"}).inputValidator((d)=>organiserSchema.extend({teamId:z.string().uuid(),name:teamSchema.shape.name,shortName:teamSchema.shape.shortName,kitColor:teamSchema.shape.kitColor,players:z.array(playerSchema.extend({id:z.string().uuid()})).min(5).max(18)}).parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))throw new Error("Invalid organiser access");
  const {data:t}=await supabaseAdmin.from("tournaments").select("team_size").eq("id",data.tournamentId).single();
  if(!t||data.players.length<t.team_size||data.players.length>t.team_size+7)throw new Error(`Squad must contain ${t?.team_size??5}–${(t?.team_size??5)+7} players`);
  if(!data.players.some(p=>p.position==="GK"))throw new Error("Choose at least one goalkeeper");
  if(data.players.filter(p=>p.isCaptain).length!==1)throw new Error("Choose exactly one captain");
  if(new Set(data.players.map(p=>p.jerseyNumber)).size!==data.players.length)throw new Error("Jersey numbers must be unique within the team");
  const {data:existing,error:readError}=await supabaseAdmin.from("players").select("id").eq("team_id",data.teamId).eq("tournament_id",data.tournamentId);
  if(readError)throw new Error(readError.message);
  if(existing?.length!==data.players.length||new Set(data.players.map(p=>p.id)).size!==data.players.length||data.players.some(p=>!existing?.some(e=>e.id===p.id)))throw new Error("Squad does not belong to this team");
  const {data:team,error}=await supabaseAdmin.from("teams").update({name:data.name,short_name:data.shortName,kit_color:data.kitColor}).eq("id",data.teamId).eq("tournament_id",data.tournamentId).select("id").maybeSingle();
  if(error)throw new Error(error.message);if(!team)throw new Error("Team not found");
  for(const p of data.players){const {error:playerError}=await supabaseAdmin.from("players").update({name:p.name,jersey_number:p.jerseyNumber,position:p.position,is_captain:p.isCaptain}).eq("id",p.id).eq("team_id",data.teamId).eq("tournament_id",data.tournamentId);if(playerError)throw new Error(playerError.message);}
  return {ok:true};
});
export const updateFixture=createServerFn({method:"POST"}).inputValidator((d)=>organiserSchema.extend({matchId:z.string().uuid(),homeTeamId:z.string().uuid().nullable(),awayTeamId:z.string().uuid().nullable(),scheduledAt:z.string().datetime({offset:true}),pitch:z.string().trim().min(1).max(80)}).parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))throw new Error("Invalid organiser access");
  if(data.homeTeamId&&data.homeTeamId===data.awayTeamId)throw new Error("Choose two different teams");
  const {data:match}=await supabaseAdmin.from("matches").select("status,home_team_id,away_team_id,updated_at").eq("id",data.matchId).eq("tournament_id",data.tournamentId).maybeSingle();if(!match)throw new Error("Fixture not found");
  if(match.status!=="scheduled"&&(data.homeTeamId!==match.home_team_id||data.awayTeamId!==match.away_team_id))throw new Error("Teams cannot change after kick-off");
  const ids=[data.homeTeamId,data.awayTeamId].filter((id):id is string=>!!id);
  if(ids.length){const {data:teams,error}=await supabaseAdmin.from("teams").select("id").eq("tournament_id",data.tournamentId).in("id",ids);if(error||teams?.length!==ids.length)throw new Error("Choose teams from this tournament");}
  const {data:changed,error}=await supabaseAdmin.from("matches").update({home_team_id:data.homeTeamId,away_team_id:data.awayTeamId,scheduled_at:data.scheduledAt,pitch:data.pitch}).eq("id",data.matchId).eq("tournament_id",data.tournamentId).eq("updated_at",match.updated_at).select("id").maybeSingle();if(error)throw new Error(error.message);if(!changed)throw new Error("Fixture changed on another device. Refresh and try again.");return {ok:true};
});
export const updateTournamentDetails=createServerFn({method:"POST"}).inputValidator((d)=>organiserSchema.extend({name:z.string().trim().min(2).max(80),venue:z.string().trim().min(2).max(120),startDate:z.string().date()}).parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))throw new Error("Invalid organiser access");
  const {error}=await supabaseAdmin.from("tournaments").update({name:data.name,venue:data.venue,start_date:data.startDate}).eq("id",data.tournamentId);if(error)throw new Error(error.message);return {ok:true};
});
export const changeScorerPin=createServerFn({method:"POST"}).inputValidator((d)=>organiserSchema.extend({pin:z.string().regex(/^\d{4}$/)}).parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))throw new Error("Invalid organiser access");
  const {error}=await supabaseAdmin.from("tournament_secrets").update({scorer_pin_hash:hash(`${data.pin}:${data.tournamentId}`)}).eq("tournament_id",data.tournamentId);if(error)throw new Error(error.message);
  const {error:sessionError}=await supabaseAdmin.from("scorer_sessions").delete().eq("tournament_id",data.tournamentId);if(sessionError)throw new Error(sessionError.message);return {ok:true};
});
export const deleteTournament=createServerFn({method:"POST"}).inputValidator((d)=>organiserSchema.parse(d)).handler(async({data})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");if(!await verifyCredential(data.tournamentId,data.token,"organiser",supabaseAdmin))return {ok:false as const,error:"Invalid organiser access"};
  const {error}=await supabaseAdmin.from("tournaments").delete().eq("id",data.tournamentId);if(error)throw new Error(error.message);return {ok:true as const};
});
