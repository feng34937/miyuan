import { useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Crosshair,
  Diamond,
  Flag,
  GameController,
  GearSix,
  GlobeHemisphereWest,
  Hexagon,
  Info,
  LockKey,
  Plus,
  ShieldChevron,
  SpeakerHigh,
  SpeakerSlash,
  Target,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { BrandMark, LegendIcon, WeaponSilhouette } from "./Icons";
import { COMPETITORS, WEAPONS, CHALLENGES, MODES, SKINS } from "../game/config";
import { levelFromXp } from "../game/rules";
import type {
  LegendId,
  ModeId,
  Profile,
  Settings,
  ViewId,
  WeaponId,
} from "../game/types";

interface LobbyProps {
  view: ViewId;
  setView: (v: ViewId) => void;
  profile: Profile;
  settings: Settings;
  portraits: Record<LegendId, string> | null;
  mode: ModeId;
  setLegend: (l: LegendId) => void;
  setWeapon: (w: WeaponId) => void;
  setSkin: (s: string) => void;
  onStart: () => void;
  onMode: () => void;
  onSettings: () => void;
  onControls: () => void;
  onAbout: () => void;
  onSquad: () => void;
  onChallenges: () => void;
  onClaim: (id: string) => void;
  onSound: () => void;
  ready: boolean;
}

export function Portrait({
  id,
  portraits,
  className = "",
}: {
  id: LegendId;
  portraits: Record<LegendId, string> | null;
  className?: string;
}) {
  return portraits ? (
    <img
      className={`portrait ${className}`}
      src={portraits[id]}
      alt={`${id.charAt(0).toUpperCase() + id.slice(1)} portrait`}
      draggable={false}
    />
  ) : (
    <div className={`portrait portrait-loading ${className}`}>
      <LegendIcon id={id} size={28} />
    </div>
  );
}

function RankBadge({ level }: { level: number }) {
  return (
    <div className="rank-badge">
      <Hexagon size={45} weight="thin" />
      <span>{level}</span>
    </div>
  );
}

export function Lobby(p: LobbyProps) {
  const competitor = COMPETITORS.find((l) => l.id === p.profile.selectedLegend)!;
  const mode = MODES.find((m) => m.id === p.mode)!;
  const level = levelFromXp(p.profile.xp);
  return (
    <div className={`lobby-shell view-${p.view}`}>
      <div className="lobby-shade" />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => p.setView("play")}
          aria-label="火线1942首页"
        >
          <BrandMark />
          <span>
            火线1942<small>二战小队枪战</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {(["play", "legends", "armory", "career"] as ViewId[]).map((v) => (
            <button
              key={v}
              onClick={() => p.setView(v)}
              className={p.view === v ? "active" : ""}
              aria-current={p.view === v ? "page" : undefined}
            >
              {v === "armory" ? "军械库" : v === "legends" ? "士兵" : v === "play" ? "出战" : "生涯"}
              {v === "play" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="account-tools">
          <div className="credits" title="参加比赛赚取军需点">
            <Diamond weight="duotone" size={17} />
            <span>{p.profile.credits.toLocaleString()}</span>
          </div>
          <span className="tool-divider" />
          <button
            className="icon-button sound-button"
            onClick={p.onSound}
            aria-label={p.settings.sound ? "静音" : "开启声音"}
          >
            {p.settings.sound ? (
              <SpeakerHigh size={20} />
            ) : (
              <SpeakerSlash size={20} />
            )}
          </button>
          <button
            className="icon-button"
            onClick={p.onSettings}
            aria-label="打开设置"
          >
            <GearSix size={22} />
          </button>
          <button
            className="mini-profile"
            onClick={() => p.setView("career")}
            aria-label="查看生涯"
          >
            <Portrait id={p.profile.selectedLegend} portraits={p.portraits} />
            <span>{level}</span>
          </button>
        </div>
      </header>

      {p.view === "play" && (
        <>
          <div className="wind-dial" aria-label="选择你的士兵"><span className="dial-center">19<br/>42</span>{COMPETITORS.map((c,i)=><button key={c.id} style={{'--dial-index':i} as CSSProperties} className={c.id===p.profile.selectedLegend?'selected':''} onClick={()=>p.setLegend(c.id)}><Portrait id={c.id} portraits={p.portraits}/><b>{c.name}</b><small>0{i+1} 战区</small></button>)}</div><main className="play-left">
            <div className="season-label">
              <span className="tiny-square" />
              第一赛季 <span className="label-divider" /> 诺曼底登陆
            </div>
            <div className="hero-copy">
              <p className="eyebrow">没有两个相同的士兵。</p>
              <h1>
                打出你的
                <br />
                <span>成名一战。</span>
              </h1>
              <p>
                找到你的优势。信任你的小队。
                <br />
                在 1942 年的前线留下你的名字。
              </p>
            </div>
            <button className="season-link" onClick={p.onAbout}>
              <span className="season-link-icon">
                <Flag size={21} />
              </span>
              <span>
                <strong>欢迎来到火线1942</strong>
                <small>你的下一段传奇由此开始</small>
              </span>
              <ArrowRight size={19} />
            </button>
            <div className="play-dock">
              <button
                className="mode-card"
                onClick={p.onMode}
                aria-label="更改游戏模式"
              >
                <div className="mode-landscape">
                  <div className="landscape-sun" />
                  <div className="landscape-mountain back" />
                  <div className="landscape-mountain front" />
                  <span className="map-grid" />
                </div>
                <span className="mode-label">
                  <span className="mode-tag">
                    {mode.label} <span>•</span>{" "}
                    {p.mode === "training" ? "练习" : "电脑小队"}
                  </span>
                  <strong>{mode.name}</strong>
                  <span className="mode-map">
                    <GlobeHemisphereWest size={13} />
                    {mode.map}
                  </span>
                </span>
                <span className="mode-change">
                  <ArrowsClockwise size={18} /> 更换
                </span>
              </button>
              <button
                className="ready-button"
                onClick={p.onStart}
                disabled={!p.ready}
              >
                <span className="ready-mark">
                  <BrandMark />
                </span>
                <span>{p.ready ? "准备出战" : "正在准备战场"}</span>
                <ArrowRight size={27} weight="bold" />
              </button>
              <div className="ready-caption">
                <span className="status-dot" />{" "}
                {p.mode === "squads"
                  ? "小队已就绪，你呢？"
                  : "你的靶场，你的规则。"}
                <span>免费游玩</span>
              </div>
            </div>
          </main>
          <div className="location-marker">
            <span className="location-line" />
            <GlobeHemisphereWest size={14} />
            <span>
              诺曼底滩头<small>49° 22′ N / 0° 52′ W</small>
            </span>
          </div>
          <div className="hero-player-tag">
            <div className="player-tag-top">
              <span className="player-level">{level}</span>
              <span>
                你<small>列兵-01</small>
              </span>
              <CheckCircle size={18} weight="fill" />
            </div>
            <div className="player-tag-stem" />
          </div>
          <button
            className="selected-competitor-tag"
            onClick={() => p.setView("legends")}
          >
            <span className="competitor-tag-class">
              <LegendIcon id={competitor.id} />
              {competitor.role}
            </span>
            <strong>{competitor.name}</strong>
            <span>
              选择士兵 <ArrowRight size={14} />
            </span>
          </button>
          <aside className="right-rail">
            <section className="squad-panel">
              <div className="rail-heading">
                <span>你的小队</span>
                <span className="small-muted">3 / 3</span>
              </div>
              <div className="squad-player self">
                <Portrait
                  id={p.profile.selectedLegend}
                  portraits={p.portraits}
                />
                <div>
                  <span>
                    列兵-01 <span className="you-chip">你</span>
                  </span>
                  <small>
                    <span className="status-dot" />
                    整装待发
                  </small>
                </div>
                <Check size={16} />
              </div>
              {[
                { id: "boren" as const, name: "磐石", role: "坚守阵线" },
                { id: "nima" as const, name: "猎鹰", role: "掩护侧翼" },
              ].map((ally) => (
                <button
                  className="squad-player"
                  key={ally.name}
                  onClick={p.onSquad}
                >
                  <Portrait id={ally.id} portraits={p.portraits} />
                  <div>
                    <span>
                      {ally.name}
                      <span className="ai-chip">AI</span>
                    </span>
                    <small>{ally.role}</small>
                  </div>
                  <LegendIcon id={ally.id} size={17} />
                </button>
              ))}
              <button
                className="subtle-button squad-details"
                onClick={p.onSquad}
              >
                <UsersThree size={16} /> 小队详情 <ArrowRight size={14} />
              </button>
            </section>
            <section className="challenges-panel">
              <div className="rail-heading">
                <span>战地任务</span>
                <Target size={15} />
              </div>
              <p className="rail-subtitle">
                一点雄心，走得更远。
              </p>
              {CHALLENGES.slice(0, 2).map((c) => {
                const progress = Math.min(p.profile[c.field], c.target);
                return (
                  <button
                    key={c.id}
                    className="challenge-preview"
                    onClick={p.onChallenges}
                  >
                    <div>
                      <span>{c.description}</span>
                      <small>
                        {Math.min(progress, c.target).toLocaleString()} /{" "}
                        {c.target.toLocaleString()}
                      </small>
                    </div>
                    <div className="progress-track">
                      <i
                        style={{ transform: `scaleX(${progress / c.target})` }}
                      />
                    </div>
                    <span className="challenge-reward">
                      <Diamond size={11} />
                      {c.reward} 军需点
                    </span>
                  </button>
                );
              })}
              <button className="text-link" onClick={p.onChallenges}>
                查看全部任务 <ArrowRight size={14} />
              </button>
            </section>
            <button className="news-card" onClick={p.onAbout}>
              <div className="news-art">
                <BrandMark />
                <span className="news-lines" />
                <span className="news-tag">战地简报 / 001</span>
              </div>
              <div className="news-text">
                <span>新战场，新规则。</span>
                <strong>这是你的 1942。</strong>
                <span className="news-cta">
                  了解前线战事 <ArrowRight size={15} />
                </span>
              </div>
            </button>
          </aside>
        </>
      )}

      {p.view === "legends" && (
        <main className="detail-view legends-view">
          <div className="detail-intro">
            <p className="eyebrow text-accent">
              成就士兵的不是战争，是你。
            </p>
            <h1>
              遇见你的
              <br />
              <span>制胜王牌。</span>
            </h1>
            <p>三种不同的本能，同一个使命。</p>
          </div>
          <div className="competitor-description">
            <div className="class-label">
              <LegendIcon id={competitor.id} />
              {competitor.role}
            </div>
            <h2>{competitor.name}</h2>
            <p className="competitor-quote">{competitor.title}</p>
            <p className="competitor-bio">{competitor.description}</p>
            <div className="ability-description">
              <span className="keycap">Q</span>
              <div>
                <strong>{competitor.ability}</strong>
                <p>{competitor.abilityDescription}</p>
              </div>
              <span>{competitor.cooldown}s</span>
            </div>
            <div className="ability-description">
              <span className="keycap">Z</span>
              <div>
                <strong>{competitor.ultimate}</strong>
                <p>{competitor.ultimateDescription}</p>
              </div>
            </div>
          </div>
          <div className="competitor-select-strip">
            {COMPETITORS.map((l) => (
              <button
                key={l.id}
                onClick={() => p.setLegend(l.id)}
                className={`competitor-select ${competitor.id === l.id ? "selected" : ""}`}
                aria-pressed={competitor.id === l.id}
              >
                <Portrait id={l.id} portraits={p.portraits} />
                <span>
                  <strong>{l.name}</strong>
                  <small>{l.role}</small>
                </span>
                <LegendIcon id={l.id} size={24} />
                {competitor.id === l.id && (
                  <span className="selected-check">
                    <Check size={12} weight="bold" />
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="competitor-looks">
            <span className="eyebrow">战地涂装</span>
            <div className="skin-options">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  title={`${s.name}${p.profile.unlockedSkins.includes(s.id) ? "" : ` · ${s.cost} 军需点`}`}
                  onClick={() => p.setSkin(s.id)}
                  className={p.profile.skin === s.id ? "active" : ""}
                  style={{ "--swatch": s.color } as CSSProperties}
                  aria-label={`${p.profile.unlockedSkins.includes(s.id) ? "装备" : "解锁"} ${s.name}`}
                >
                  <span />
                  {!p.profile.unlockedSkins.includes(s.id) && (
                    <LockKey size={12} />
                  )}
                </button>
              ))}
            </div>
            <small>{SKINS.find((s) => s.id === p.profile.skin)?.name}</small>
          </div>
          <div className="character-index">
            <span>0{COMPETITORS.findIndex((l) => l.id === competitor.id) + 1}</span> /
            03
          </div>
        </main>
      )}

      {p.view === "armory" && <Armory {...p} />}
      {p.view === "career" && (
        <main className="career-view">
          <div className="detail-intro">
            <p className="eyebrow text-accent">每场战斗都算数。</p>
            <h1>
              你的故事。
              <br />
              <span>尚待书写。</span>
            </h1>
            <p>每场比赛，都是你在火线1942留下的新印记。</p>
          </div>
          <div className="career-content">
            <div className="career-profile">
              <RankBadge level={level} />
              <div>
                <span className="eyebrow">火线新兵</span>
                <h2>列兵-01</h2>
                <p>
                  等级 {level} <span>·</span> {p.profile.xp.toLocaleString()}{" "}
                  总经验值
                </p>
              </div>
              <Portrait id={p.profile.selectedLegend} portraits={p.portraits} />
            </div>
            <div className="level-progress">
              <div>
                <span>下一篇章</span>
                <span>{p.profile.xp % 600} / 600 经验值</span>
              </div>
              <div className="progress-track">
                <i
                  style={{ transform: `scaleX(${(p.profile.xp % 600) / 600})` }}
                />
              </div>
            </div>
            <div className="career-stats">
              {[
                { icon: Trophy, value: p.profile.wins, label: "胜场" },
                {
                  icon: Crosshair,
                  value: p.profile.kills,
                  label: "击毙数",
                },
                {
                  icon: ShieldChevron,
                  value: p.profile.damage,
                  label: "造成伤害",
                },
                {
                  icon: Flag,
                  value: p.profile.matches,
                  label: "已玩场次",
                },
              ].map((s) => (
                <div key={s.label}>
                  <s.icon size={23} />
                  <strong>{s.value.toLocaleString()}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="career-objectives">
              <div className="rail-heading">
                <span>战地任务</span>
                <span className="small-muted">
                  {p.profile.claimedChallenges.length} / 3 已完成
                </span>
              </div>
              {CHALLENGES.map((c) => {
                const progress = Math.min(p.profile[c.field], c.target),
                  done = progress >= c.target,
                  claimed = p.profile.claimedChallenges.includes(c.id);
                return (
                  <div className="career-challenge" key={c.id}>
                    <span className={`objective-icon ${done ? "done" : ""}`}>
                      {claimed ? <Check size={21} /> : <Target size={21} />}
                    </span>
                    <div>
                      <strong>{c.title}</strong>
                      <p>{c.description}</p>
                      <div className="progress-track">
                        <i
                          style={{
                            transform: `scaleX(${progress / c.target})`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="objective-count">
                      {progress.toLocaleString()} / {c.target.toLocaleString()}
                    </span>
                    <button
                      onClick={() => p.onClaim(c.id)}
                      disabled={!done || claimed}
                      className={`reward-button ${done && !claimed ? "claimable" : ""}`}
                    >
                      {claimed ? (
                        <>
                          <Check size={14} />
                          已领取
                        </>
                      ) : done ? (
                        <>
                          <Diamond size={14} />
                          领取 {c.reward}
                        </>
                      ) : (
                        <>
                          <Diamond size={14} />
                          {c.reward}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      <footer className="lobby-footer">
        <div className="server-status">
          <span className="status-dot" />
          <span>
            本地战区 <span className="footer-slash">/</span>{" "}
            {p.mode === "squads" ? "单人 + 电脑小队" : "训练场"}
          </span>
          <span className="version">BUILD 01.04</span>
        </div>
        <div className="footer-links">
          <button onClick={p.onControls}>
            <GameController size={17} />
            <span>玩法说明</span>
          </button>
          <button onClick={p.onAbout}>
            <Info size={16} />
            <span>战地手册</span>
          </button>
          <span className="footer-key">F11</span>
          <span className="fullscreen-hint">全屏</span>
        </div>
      </footer>
    </div>
  );
}

function Armory(p: LobbyProps) {
  const weapon = WEAPONS.find((w) => w.id === p.profile.selectedWeapon)!;
  const [tab, setTab] = useState<"specs" | "tips">("specs");
  return (
    <main className="detail-view armory-view">
      <div className="detail-intro">
        <p className="eyebrow text-accent">趁手的武器，你的规则。</p>
        <h1>
          为此刻
          <br />
          <span>而生。</span>
        </h1>
        <p>找到那把如臂使指的武器。</p>
      </div>
      <div className="weapon-description">
        <span className="class-label">
          <Crosshair size={18} />
          {weapon.class}
        </span>
        <h2>{weapon.name}</h2>
        <p>{weapon.description}</p>
        <div className="weapon-tabs">
          <button
            className={tab === "specs" ? "active" : ""}
            onClick={() => setTab("specs")}
          >
            规格参数
          </button>
          <button
            className={tab === "tips" ? "active" : ""}
            onClick={() => setTab("tips")}
          >
            战地心得
          </button>
        </div>
        {tab === "specs" ? (
          <>
            <div className="weapon-stats">
              {["伤害", "射速", "射程", "精准度"].map((label, i) => (
                <div key={label}>
                  <span>{label}</span>
                  <div className="progress-track">
                    <i
                      style={{ transform: `scaleX(${weapon.stats[i] / 100})` }}
                    />
                  </div>
                  <b>{weapon.stats[i]}</b>
                </div>
              ))}
            </div>
            <div className="weapon-numbers">
              <div>
                <strong>{weapon.magazine}</strong>
                <span>弹匣容量</span>
              </div>
              <div>
                <strong>
                  {weapon.reload.toFixed(2)}
                  <small>s</small>
                </strong>
                <span>装填时间</span>
              </div>
              <div>
                <strong>{weapon.damage * weapon.pellets}</strong>
                <span>基础伤害</span>
              </div>
            </div>
          </>
        ) : (
          <div className="weapon-tips">
            <p>
              {weapon.id === "carbine"
                ? "对远处的敌人使用短点射。机瞄可提高精度，推进前先在掩体后换弹。"
                : weapon.id === "breacher"
                  ? "利用雷恩的冲锋突袭拉近距离。将准星保持在目标中心，让全部八枚弹丸命中。"
                  : "保持视线畅通，瞄准钢盔。爆头可额外造成 65% 伤害。每次射击后转移阵地。"}
            </p>
            <div>
              <span className="keycap">R</span>换弹{" "}
              <span className="keycap">右键</span>瞄准
            </div>
          </div>
        )}
      </div>
      <div className="weapon-select-strip">
        {WEAPONS.map((w) => (
          <button
            key={w.id}
            onClick={() => p.setWeapon(w.id)}
            className={`weapon-select ${w.id === weapon.id ? "selected" : ""}`}
            aria-pressed={w.id === weapon.id}
          >
            <WeaponSilhouette variant={w.id} />
            <div>
              <span>{w.class}</span>
              <strong>{w.name}</strong>
            </div>
            {w.id === weapon.id ? (
              <CheckCircle size={19} weight="fill" />
            ) : (
              <Plus size={19} />
            )}
          </button>
        ))}
      </div>
      <div className="equipped-indicator">
        <CheckCircle size={18} weight="fill" />
        已装备，下次出战生效
      </div>
    </main>
  );
}

export function ModePicker({
  mode,
  onSelect,
}: {
  mode: ModeId;
  onSelect: (m: ModeId) => void;
}) {
  return (
    <div className="mode-options">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`mode-option ${mode === m.id ? "selected" : ""}`}
          onClick={() => onSelect(m.id)}
        >
          <div className="mode-option-art">
            <div className="landscape-sun" />
            <div className="landscape-mountain back" />
            <div className="landscape-mountain front" />
            {m.id === "squads" ? (
              <UsersThree size={49} weight="thin" />
            ) : (
              <Crosshair size={49} weight="thin" />
            )}
            <span>{m.label}</span>
          </div>
          <div className="mode-option-body">
            <span className="eyebrow">{m.map}</span>
            <h3>{m.name}</h3>
            <p>{m.description}</p>
            <div className="mode-detail">
              <span>{m.detail}</span>
              <span>{m.time}</span>
            </div>
            <span className="mode-select-button">
              {mode === m.id ? "已选择" : "选择模式"}
              {mode === m.id ? (
                <CheckCircle size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
