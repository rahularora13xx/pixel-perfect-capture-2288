import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSquad, shortCode, squadFromClub, type SavedMember } from "./quick-match";

describe("one-off match setup", () => {
  test("short code is three characters from the name", () => {
    assert.equal(shortCode("Google"), "GOO");
    assert.equal(shortCode("fc 9"), "FC9");
    assert.equal(shortCode("A"), "AXX");
  });
  test("short code avoids the other team's code", () => {
    assert.equal(shortCode("Google B", "GOO"), "GO2");
    assert.equal(shortCode("AB2", "AB2"), "AB3");
  });
  test("empty squad is a full side with one keeper and one captain", () => {
    const squad = buildSquad("", 7);
    assert.equal(squad.length, 7);
    assert.deepEqual(squad.map(p => p.position), ["GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD"]);
    assert.equal(squad.filter(p => p.isCaptain).length, 1);
    assert.equal(new Set(squad.map(p => p.jerseyNumber)).size, 7);
  });
  test("typed names are used first and extras go to the bench", () => {
    const squad = buildSquad("Khush\n Rahul \n\nX\nRohan\nYash\nAdii\nAkshay", 5);
    assert.deepEqual(squad.map(p => p.name), ["Khush", "Rahul", "Rohan", "Yash", "Adii", "Akshay"]);
    assert.equal(squad[5]?.position, "MID");
  });
  test("squad never exceeds a side plus seven substitutes", () => {
    assert.equal(buildSquad(Array.from({ length: 30 }, (_, i) => `Name ${i}`).join("\n"), 5).length, 12);
  });
  test("saved team keeps profile links, shirt numbers and the captain", () => {
    const member = (n: number, patch: Partial<SavedMember> = {}): SavedMember => ({ id: `m${n}`, name: `Member ${n}`, profileId: `p${n}`, jerseyNumber: n, position: "MID", isCaptain: false, ...patch });
    const squad = squadFromClub([member(9, { isCaptain: true }), member(1, { position: "GK" }), member(4, { profileId: null }), member(7), member(10)], 5);
    assert.deepEqual(squad.map(p => p.jerseyNumber), [1, 4, 7, 9, 10]);
    assert.deepEqual(squad.map(p => p.profileId), ["p1", null, "p7", "p9", "p10"]);
    assert.deepEqual(squad.filter(p => p.isCaptain).map(p => p.clubMemberId), ["m9"]);
  });
  test("short saved team is topped up and always has a keeper and a captain", () => {
    const squad = squadFromClub([{ id: "a", name: "Solo", profileId: null, jerseyNumber: 2, position: "FWD", isCaptain: false }], 5);
    assert.equal(squad.length, 5);
    assert.equal(new Set(squad.map(p => p.jerseyNumber)).size, 5);
    assert.equal(squad.filter(p => p.position === "GK").length, 1);
    assert.equal(squad.filter(p => p.isCaptain).length, 1);
  });
  test("saved team is capped at a side plus seven substitutes", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, name: `M ${i}`, profileId: null, jerseyNumber: i + 1, position: "MID", isCaptain: false }));
    assert.equal(squadFromClub(many, 5).length, 12);
  });
});
