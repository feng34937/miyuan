import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDamage,
  resolveMovement,
  ringAt,
  rewards,
  recordMatch,
  readProfile,
  readSettings,
  formatTime,
} from "./rules.ts";
import { INITIAL_PROFILE } from "./types.ts";

test("shields absorb damage before health, including a single lethal shot", () => {
  assert.deepEqual(applyDamage(100, 75, 30), {
    health: 100,
    shield: 45,
    damage: 30,
  });
  assert.deepEqual(applyDamage(100, 20, 45), {
    health: 75,
    shield: 0,
    damage: 45,
  });
  assert.deepEqual(applyDamage(20, 5, 100), {
    health: 0,
    shield: 0,
    damage: 25,
  });
  assert.deepEqual(applyDamage(70, 10, -8), {
    health: 70,
    shield: 10,
    damage: 0,
  });
});

test("player collision blocks cover penetration and lets movement slide along walls", () => {
  const cover = [{ x: 0, z: 0, halfX: 2, halfZ: 2, height: 3 }];
  const next = resolveMovement(2.6, 0, -0.4, 0.4, cover);
  assert.equal(next.x, 2.6);
  assert.equal(next.z, 0.4);
  const outside = resolveMovement(65, 0, 5, 0, []);
  assert.equal(Math.hypot(outside.x, outside.z), 66);
  let position = { x: 0, z: 5 };
  for (let i = 0; i < 15; i++)
    position = resolveMovement(position.x, position.z, 0, -0.5, cover);
  assert.ok(position.z >= 2.48, "a phase dash must stop at cover");
});

test("closing ring respects initial grace period and never shrinks below its final radius", () => {
  assert.equal(ringAt(0), 67);
  assert.equal(ringAt(44.9), 67);
  assert.equal(ringAt(45), 67);
  assert.ok(ringAt(120) < ringAt(90));
  assert.equal(ringAt(180), 14);
  assert.equal(ringAt(10000), 14);
});

test("a completed squad match grants exact earned progression, while practice grants none", () => {
  const reward = rewards(3, 480, true);
  const match = {
    reason: "champion",
    kills: 3,
    damage: 480,
    assists: 2,
    duration: 81,
    placement: 1,
    mode: "squads",
    ...reward,
  };
  const original = structuredClone(INITIAL_PROFILE);
  const profile = recordMatch(original, match);
  assert.equal(profile.wins, 1);
  assert.equal(profile.matches, 1);
  assert.equal(profile.kills, 3);
  assert.equal(profile.bestDamage, 480);
  assert.equal(profile.credits, 124);
  assert.equal(profile.xp, 675);
  assert.equal(
    original.matches,
    0,
    "saving progress must not mutate existing React state",
  );
  assert.deepEqual(
    recordMatch(original, { ...match, mode: "training" }),
    original,
  );
});

test("malformed or stale local saves cannot break the lobby or unlock unearned finishes", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  values.set("windward-relay-profile-v1", "{broken");
  assert.equal(readProfile().selectedLegend, "tavi");
  values.set(
    "windward-relay-profile-v1",
    JSON.stringify({
      xp: -7,
      credits: "free",
      selectedLegend: "missing",
      skin: "signal",
      unlockedSkins: [null, "unknown"],
      claimedChallenges: ["unknown"],
      kills: 4.9,
    }),
  );
  const saved = readProfile();
  assert.equal(saved.xp, 0);
  assert.equal(saved.credits, 0);
  assert.equal(saved.skin, "carbon");
  assert.equal(saved.selectedLegend, "tavi");
  assert.deepEqual(saved.unlockedSkins, ["carbon"]);
  assert.deepEqual(saved.claimedChallenges, []);
  assert.equal(saved.kills, 4);
  values.set(
    "windward-relay-settings-v1",
    JSON.stringify({ sensitivity: 500, volume: -10, quality: "ultra" }),
  );
  assert.equal(readSettings().sensitivity, 100);
  assert.equal(readSettings().volume, 0);
  assert.equal(readSettings().quality, "high");
  delete globalThis.localStorage;
});

test("HUD timer remains valid at zero, during countdown, and across minute boundaries", () => {
  assert.equal(formatTime(-1), "0:00");
  assert.equal(formatTime(59.9), "0:59");
  assert.equal(formatTime(60), "1:00");
  assert.equal(formatTime(180), "3:00");
});
