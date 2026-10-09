import { test } from "node:test";
import assert from "node:assert/strict";
import { knockoutFixtures } from "./knockout-fixtures";

const tournamentId = "00000000-0000-4000-8000-000000000001";
const base = new Date("2026-10-09T09:00:00Z");

test("hybrid knockout placeholders are null, never empty UUIDs", () => {
  for (const count of [2, 4]) {
    const fixtures = knockoutFixtures(tournamentId, Array<string | null>(count).fill(null), base);
    assert.equal(fixtures.length, count - 1);
    for (const fixture of fixtures) {
      assert.equal(fixture.home_team_id, null);
      assert.equal(fixture.away_team_id, null);
    }
  }
});

test("legacy empty placeholders are normalized to null", () => {
  const fixtures = knockoutFixtures(tournamentId, ["", "", "", ""], base);
  assert.equal(fixtures.length, 3);
  assert.ok(fixtures.every(fixture => fixture.home_team_id === null && fixture.away_team_id === null));
});

test("known teams stay assigned and missing bye opponents are null", () => {
  const ids = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`);
  const fixtures = knockoutFixtures(tournamentId, ids, base);
  assert.equal(fixtures.length, 7);
  const firstRound = fixtures.filter(fixture => fixture.round_number === 1);
  assert.deepEqual(firstRound.map(fixture => fixture.home_team_id), ids.slice(0, 4));
  assert.deepEqual(firstRound.map(fixture => fixture.away_team_id), [null, null, null, ids[4]]);
  for (const fixture of firstRound) {
    assert.ok(fixtures.some(next => next.id === fixture.next_match_id));
  }
});