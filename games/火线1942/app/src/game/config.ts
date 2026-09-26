import type { Competitor, Weapon } from "./types";

export const COMPETITORS: Competitor[] = [
  {
    id: "tavi",
    name: "雷恩",
    role: "突击兵",
    title: "永远冲在最前。",
    quote: "“跟我上！”",
    description:
      "第101空降师的老兵，胸前挂着一排勋章。雷恩总能在枪林弹雨中找到敌人防线的突破口。",
    color: "#c8a24b",
    ability: "冲锋突袭",
    abilityDescription: "向移动方向快速突进，并获得 1.2 秒无敌。",
    ultimate: "火力压制",
    ultimateDescription: "持续 10 秒：移动更快，射击不消耗弹药。",
    cooldown: 9,
    speed: 9.5,
    shield: 75,
  },
  {
    id: "boren",
    name: "布鲁克",
    role: "支援兵",
    title: "守住这条线。",
    quote: "“一步也不许退。”",
    description:
      "背着医疗包和防弹钢板的工兵出身支援兵。布鲁克在哪里，小队的防线就在哪里。",
    color: "#8a9a7b",
    ability: "战地急救",
    abilityDescription: "恢复 45 点护甲，受到的伤害降低 65%，持续 5 秒。",
    ultimate: "钢铁防线",
    ultimateDescription: "恢复全队的生命与护甲，并获得 10 秒伤害抗性。",
    cooldown: 14,
    speed: 8,
    shield: 100,
  },
  {
    id: "nima",
    name: "薇拉",
    role: "侦察兵",
    title: "他们无处可藏。",
    quote: "“我看得见他们的每一步。”",
    description:
      "带着望远镜和无线电台的侦察兵。薇拉能洞察战场上每一个敌人的动向，为炮兵指引目标。",
    color: "#9fb4b8",
    ability: "照明弹",
    abilityDescription: "发射照明弹，显示所有敌人位置 8 秒，并干扰附近的敌人。",
    ultimate: "炮火覆盖",
    ultimateDescription: "呼叫炮火齐射，对 32 米内的敌人造成 70 点伤害。",
    cooldown: 12,
    speed: 9,
    shield: 75,
  },
];

export const WEAPONS: Weapon[] = [
  {
    id: "carbine",
    name: "STG-44",
    class: "突击步枪",
    description:
      "稳定、可靠、火力持续。传奇的二战突击步枪，任何距离的交战都得心应手。",
    damage: 19,
    magazine: 28,
    interval: 0.115,
    reload: 1.65,
    range: 85,
    pellets: 1,
    spread: 0.016,
    stats: [65, 86, 72, 77],
  },
  {
    id: "breacher",
    name: "M1897 战壕枪",
    class: "霰弹枪",
    description:
      "堑壕清扫者。贴近目标，八枚弹丸在近距离给出毁灭性的回答。",
    damage: 13,
    magazine: 8,
    interval: 0.72,
    reload: 2.0,
    range: 34,
    pellets: 8,
    spread: 0.07,
    stats: [96, 35, 28, 55],
  },
  {
    id: "longshot",
    name: "春田 M1903",
    class: "狙击步枪",
    description:
      "找准角度，一击致命。为耐心的猎手准备的远程精准利器。",
    damage: 58,
    magazine: 10,
    interval: 0.52,
    reload: 1.9,
    range: 125,
    pellets: 1,
    spread: 0.006,
    stats: [88, 46, 98, 90],
  },
];

export const MODES = [
  {
    id: "squads" as const,
    name: "小队突围",
    label: "三人小队",
    detail: "你 + 2名电脑队友 · 3支敌方小队",
    description: "九名敌军，一圈不断收缩的炮火。带领你的小队战斗到最后。",
    time: "3 分钟",
    map: "诺曼底滩头",
  },
  {
    id: "training" as const,
    name: "靶场训练",
    label: "单人",
    detail: "练习 · 无限重生",
    description: "熟悉你的士兵，试用每一把武器，找到属于你的手感。",
    time: "自由探索",
    map: "后方训练营",
  },
];

export const SKINS = [
  { id: "carbon", name: "制式军绿", color: "#5d6647", cost: 0 },
  { id: "sandstorm", name: "沙漠迷彩", color: "#c2a375", cost: 120 },
  { id: "signal", name: "烈焰红", color: "#b85f43", cost: 180 },
];

export const CHALLENGES = [
  {
    id: "first-drop",
    title: "踏上战场",
    description: "完成一场小队比赛",
    target: 1,
    field: "matches" as const,
    reward: 60,
  },
  {
    id: "sharpshooter",
    title: "弹无虚发",
    description: "造成 1,000 点伤害",
    target: 1000,
    field: "damage" as const,
    reward: 80,
  },
  {
    id: "champion",
    title: "初露锋芒",
    description: "赢得一场小队比赛",
    target: 1,
    field: "wins" as const,
    reward: 120,
  },
];

export const CONTROLS = [
  ["W A S D", "移动"],
  ["鼠标", "环顾四周"],
  ["鼠标左键", "开火"],
  ["鼠标右键", "机瞄瞄准"],
  ["SHIFT", "疾跑"],
  ["空格", "跳跃"],
  ["C", "滑铲"],
  ["R", "换弹"],
  ["Q", "战术技能"],
  ["Z", "终极技能"],
  ["E", "医疗包"],
  ["G", "手榴弹"],
  ["TAB / M", "战术地图"],
  ["ESC / P", "暂停"],
];
