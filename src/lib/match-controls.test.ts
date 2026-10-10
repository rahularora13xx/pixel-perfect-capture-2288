import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected), toEqual: (expected: unknown) => assert.deepEqual(actual, expected), toThrow: () => { if (typeof actual !== "function") throw new Error("Expected a function"); assert.throws(actual as () => void); } });
import { announcedAddedMinutes, clockPatch, elapsedSeconds, matchClock, matchMinute, type ClockMatch } from "./match-controls";

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
  test("live clock shows minutes and seconds", () => {
    expect(matchClock(scheduled, 20, now)).toBe("00:00");
    expect(matchClock({ ...scheduled, status: "first_half", clock_running: true, clock_elapsed_seconds: 60, clock_started_at: new Date(now - 65000).toISOString() }, 20, now)).toBe("02:05");
    expect(matchClock({ ...scheduled, status: "second_half", clock_elapsed_seconds: 1205 }, 20, now)).toBe("20:05");
  });
  test("live clock shows stoppage past the end of a half", () => {
    expect(matchClock({ ...scheduled, status: "first_half", clock_elapsed_seconds: 1283 }, 20, now)).toBe("20:00 +1:23");
    expect(matchClock({ ...scheduled, status: "second_half", clock_elapsed_seconds: 2410 }, 20, now)).toBe("40:00 +0:10");
  });
  test("announced added time applies only to the half being played", () => {
    const added = { first_half_added_minutes: 2, second_half_added_minutes: 4 };
    expect(announcedAddedMinutes({ status: "first_half", ...added })).toBe(2);
    expect(announcedAddedMinutes({ status: "half_time", ...added })).toBe(0);
    expect(announcedAddedMinutes({ status: "second_half", ...added })).toBe(4);
  });
  test("stopped clock does not grow", () => {
    expect(elapsedSeconds({ ...scheduled, clock_elapsed_seconds: 125 }, now)).toBe(125);
  });
});