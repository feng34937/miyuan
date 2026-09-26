export type LegendId = "tavi" | "boren" | "nima";
export type WeaponId = "carbine" | "breacher" | "longshot";
export type ModeId = "squads" | "training";
export type ViewId = "play" | "legends" | "armory" | "career";
export type MatchPhase = "lobby" | "countdown" | "playing" | "paused" | "ended";
export type FinishReason = "champion" | "eliminated" | "timeout" | "training";

export interface Settings {
  sensitivity: number;
  volume: number;
  quality: "high" | "low";
  sound: boolean;
  invertY: boolean;
}

export interface Competitor {
  id: LegendId;
  name: string;
  role: string;
  title: string;
  quote: string;
  description: string;
  color: string;
  ability: string;
  abilityDescription: string;
  ultimate: string;
  ultimateDescription: string;
  cooldown: number;
  speed: number;
  shield: number;
}

export interface Weapon {
  id: WeaponId;
  name: string;
  class: string;
  description: string;
  damage: number;
  magazine: number;
  interval: number;
  reload: number;
  range: number;
  pellets: number;
  spread: number;
  stats: [number, number, number, number];
}

export interface Profile {
  xp: number;
  credits: number;
  matches: number;
  wins: number;
  kills: number;
  damage: number;
  bestDamage: number;
  selectedLegend: LegendId;
  selectedWeapon: WeaponId;
  skin: string;
  unlockedSkins: string[];
  claimedChallenges: string[];
}

export interface MatchResult {
  reason: FinishReason;
  kills: number;
  assists: number;
  damage: number;
  duration: number;
  placement: number;
  xp: number;
  credits: number;
  mode: ModeId;
}

export interface EntitySnapshot {
  id: string;
  name: string;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  ally: boolean;
  alive: boolean;
  screenX?: number;
  screenY?: number;
}

export interface GameSnapshot {
  phase: MatchPhase;
  countdown: number;
  health: number;
  shield: number;
  maxShield: number;
  ammo: number;
  maxAmmo: number;
  reloading: number;
  kills: number;
  assists: number;
  damage: number;
  remaining: number;
  time: number;
  ringRadius: number;
  abilityCooldown: number;
  healCooldown: number;
  grenadeCooldown: number;
  ultimate: number;
  activeAbility: number;
  hit: number;
  damageFlash: number;
  lastDamage: number;
  aiming: boolean;
  sprinting: boolean;
  x: number;
  z: number;
  yaw: number;
  outOfRing: boolean;
  feed: { id: number; text: string; time: number; ally: boolean }[];
  entities: EntitySnapshot[];
  message: string;
  messageTime: number;
  fps: number;
  locked: boolean;
}

export interface MatchOptions {
  competitor: LegendId;
  weapon: WeaponId;
  mode: ModeId;
  skin: string;
}

export interface Obstacle {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 45,
  volume: 55,
  quality: "high",
  sound: true,
  invertY: false,
};
export const INITIAL_PROFILE: Profile = {
  xp: 0,
  credits: 0,
  matches: 0,
  wins: 0,
  kills: 0,
  damage: 0,
  bestDamage: 0,
  selectedLegend: "tavi",
  selectedWeapon: "carbine",
  skin: "carbon",
  unlockedSkins: ["carbon"],
  claimedChallenges: [],
};
