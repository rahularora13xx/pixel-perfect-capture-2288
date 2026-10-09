export type ClockMatch = { status: string; clock_elapsed_seconds: number; clock_started_at: string | null; clock_running: boolean };
export type ClockAction = "start_first" | "half_time" | "start_second" | "pause" | "resume" | "full_time" | "correct_clock";

export function elapsedSeconds(match: ClockMatch, now = Date.now()) {
  const delta = match.clock_running && match.clock_started_at ? Math.max(0, Math.floor((now - Date.parse(match.clock_started_at)) / 1000)) : 0;
  return match.clock_elapsed_seconds + delta;
}

export function clockPatch(match: ClockMatch, action: ClockAction, halfMinutes: number, now = Date.now(), correction?: number) {
  const elapsed = elapsedSeconds(match, now);
  const running = ["first_half", "second_half"].includes(match.status);
  const start = (status: string, seconds: number) => ({ status, clock_running: true, clock_started_at: new Date(now).toISOString(), clock_elapsed_seconds: seconds });
  const stop = (status: string) => ({ status, clock_running: false, clock_started_at: null, clock_elapsed_seconds: elapsed });
  if (action === "start_first" && match.status === "scheduled") return start("first_half", 0);
  if (action === "half_time" && match.status === "first_half") return stop("half_time");
  if (action === "start_second" && match.status === "half_time") return start("second_half", halfMinutes * 60);
  if (action === "pause" && running && match.clock_running) return stop(match.status);
  if (action === "resume" && running && !match.clock_running) return start(match.status, elapsed);
  if (action === "full_time" && match.status === "second_half") return stop("full_time");
  if (action === "correct_clock" && running && correction !== undefined && Number.isInteger(correction) && correction >= 0 && correction <= 10800) {
    return { status: match.status, clock_elapsed_seconds: correction, clock_running: match.clock_running, clock_started_at: match.clock_running ? new Date(now).toISOString() : null };
  }
  throw new Error("This action is not available at the current match stage. Refresh and try again.");
}

export function matchMinute(match: ClockMatch, halfMinutes: number, now = Date.now()) {
  const seconds = elapsedSeconds(match, now);
  const minute = Math.floor(seconds / 60);
  const end = match.status === "first_half" || match.status === "half_time" ? halfMinutes : halfMinutes * 2;
  return minute > end ? `${end}+${minute - end}` : String(minute);
}