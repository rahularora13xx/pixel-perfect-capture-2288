import { describe, expect, test } from "bun:test";
import { clockPatch, elapsedSeconds, matchMinute, type ClockMatch } from "./match-controls";

const now = Date.parse("2026-10-09T05:20:00Z");
const scheduled: ClockMatch = { status: "scheduled", clock_elapsed_seconds: 0, clock_started_at: null, clock_running: false };
describe("match clock", () => {
  test("start first half from scheduled", () => {
    expect(clockPatch(scheduled, "start_first", 20, now)).toEqual({ status: "first_half", clock_running: true, clock_started_at: new Date(now).toISOString(), clock_elapsed_seconds: 0 });
  });
  test("pause preserves the elapsed live time", () => {
    const live = { ...scheduled, status: "first_half", clock_running: true, clock_elapsed_seconds: 60, clock_started_at: new Date(now - 120000).toISOString() };
    expect(clockPatch(live, "pause", 20, now).clock_elapsed_seconds).toBe(180);
  });
  test("resume does not reset the clock", () => {
    expect(clockPatch({ ...scheduled, status: "first_half", clock_elapsed_seconds: 180 }, "resume", 20, now).clock_elapsed_seconds).toBe(180);
  });
  test("two 20-minute halves start second half at 20 minutes", () => {
    expect(clockPatch({ ...scheduled, status: "half_time", clock_elapsed_seconds: 1320 }, "start_second", 20, now).clock_elapsed_seconds).toBe(1200);
  });
  test("stoppage time displays 20+2", () => {
    expect(matchMinute({ ...scheduled, status: "first_half", clock_elapsed_seconds: 1320 }, 20, now)).toBe("20+2");
  });
  test("finished matches cannot restart", () => {
    expect(() => clockPatch({ ...scheduled, status: "full_time" }, "start_first", 20, now)).toThrow();
  });
  test("full time requires the second half", () => {
    expect(() => clockPatch(scheduled, "full_time", 20, now)).toThrow();
    expect(clockPatch({ ...scheduled, status: "second_half" }, "full_time", 20, now).status).toBe("full_time");
  });
  test("manual correction persists seconds", () => {
    expect(clockPatch({ ...scheduled, status: "first_half" }, "correct_clock", 20, now, 125).clock_elapsed_seconds).toBe(125);
  });
  test("stopped clock does not grow", () => {
    expect(elapsedSeconds({ ...scheduled, clock_elapsed_seconds: 125 }, now)).toBe(125);
  });
});