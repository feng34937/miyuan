import type { Obstacle, Profile, MatchResult, Settings } from "./types.ts";
import { INITIAL_PROFILE, DEFAULT_SETTINGS } from "./types.ts";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function applyDamage(health: number, shield: number, damage: number) {
  const amount = Math.max(0, damage);
  const absorbed = Math.min(shield, amount);
  return {
    health: Math.max(0, health - (amount - absorbed)),
    shield: Math.max(0, shield - absorbed),
    damage: Math.min(health + shield, amount),
  };
}

export function resolveMovement(
  x: number,
  z: number,
  dx: number,
  dz: number,
  obstacles: Obstacle[],
  radius = 0.48,
) {
  const blocked = (px: number, pz: number) =>
    obstacles.some(
      (o) =>
        Math.abs(px - o.x) < o.halfX + radius &&
        Math.abs(pz - o.z) < o.halfZ + radius,
    );
  let nextX = blocked(x + dx, z) ? x : x + dx;
  let nextZ = blocked(nextX, z + dz) ? z : z + dz;
  const distance = Math.hypot(nextX, nextZ);
  if (distance > 66) {
    nextX *= 66 / distance;
    nextZ *= 66 / distance;
  }
  return { x: nextX, z: nextZ };
}

export function ringAt(time: number) {
  if (time < 45) return 67;
  return Math.max(14, 67 - (time - 45) * 0.45);
}

export function levelFromXp(xp: number) {
  return Math.floor(Math.max(0, xp) / 600) + 1;
}

export function rewards(kills: number, damage: number, won: boolean) {
  return {
    xp: 120 + kills * 65 + Math.floor(damage / 8) + (won ? 300 : 0),
    credits: 25 + kills * 8 + (won ? 75 : 0),
  };
}

export function recordMatch(profile: Profile, result: MatchResult): Profile {
  if (result.mode === "training") return profile;
  return {
    ...profile,
    xp: profile.xp + result.xp,
    credits: profile.credits + result.credits,
    matches: profile.matches + 1,
    wins: profile.wins + (result.reason === "champion" ? 1 : 0),
    kills: profile.kills + result.kills,
    damage: profile.damage + result.damage,
    bestDamage: Math.max(profile.bestDamage, result.damage),
  };
}

export function readProfile(): Profile {
  try {
    const data = JSON.parse(
      localStorage.getItem("windward-relay-profile-v1") || "null",
    );
    if (!data || typeof data !== "object") return { ...INITIAL_PROFILE };
    const result = { ...INITIAL_PROFILE };
    for (const field of [
      "xp",
      "credits",
      "matches",
      "wins",
      "kills",
      "damage",
      "bestDamage",
    ] as const) {
      if (Number.isFinite(data[field]) && data[field] >= 0)
        result[field] = Math.floor(data[field]);
    }
    if (["tavi", "boren", "nima"].includes(data.selectedLegend))
      result.selectedLegend = data.selectedLegend;
    if (["carbine", "breacher", "longshot"].includes(data.selectedWeapon))
      result.selectedWeapon = data.selectedWeapon;
    if (Array.isArray(data.unlockedSkins))
      result.unlockedSkins = [
        ...new Set([
          "carbon",
          ...data.unlockedSkins.filter((s: unknown) =>
            ["carbon", "sandstorm", "signal"].includes(s as string),
          ),
        ]),
      ];
    if (result.unlockedSkins.includes(data.skin)) result.skin = data.skin;
    if (Array.isArray(data.claimedChallenges))
      result.claimedChallenges = data.claimedChallenges.filter((s: unknown) =>
        ["first-drop", "sharpshooter", "champion"].includes(s as string),
      );
    return result;
  } catch {
    return { ...INITIAL_PROFILE };
  }
}

export function readSettings(): Settings {
  try {
    const data = JSON.parse(
      localStorage.getItem("windward-relay-settings-v1") || "null",
    );
    if (!data || typeof data !== "object") return { ...DEFAULT_SETTINGS };
    return {
      sensitivity: Number.isFinite(data.sensitivity)
        ? clamp(data.sensitivity, 10, 100)
        : 45,
      volume: Number.isFinite(data.volume) ? clamp(data.volume, 0, 100) : 55,
      quality: data.quality === "low" ? "low" : "high",
      sound: data.sound !== false,
      invertY: data.invertY === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The game remains playable when browser storage is unavailable. */
  }
}

export const formatTime = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
