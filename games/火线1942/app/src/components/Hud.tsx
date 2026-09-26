import { useRef } from "react";
import {
  ArrowsOut,
  ArrowUp,
  Check,
  Crosshair,
  FirstAid,
  Flag,
  Lightning,
  MapTrifold,
  Pause,
  Shield,
  Skull,
  Target,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { BrandMark, LegendIcon, WeaponSilhouette } from "./Icons";
import { Portrait } from "./Lobby";
import { COMPETITORS, WEAPONS } from "../game/config";
import { formatTime } from "../game/rules";
import type { RelayEngine } from "../game/engine";
import type { GameSnapshot, LegendId, MatchOptions } from "../game/types";

export function TacticalMap({
  state,
  large = false,
  onClose,
}: {
  state: GameSnapshot;
  large?: boolean;
  onClose?: () => void;
}) {
  const scale = (v: number) => (v / 134) * 200 + 100;
  return (
    <div className={`tactical-map ${large ? "map-large" : ""}`}>
      {large && (
        <div className="map-header">
          <div>
            <span className="eyebrow text-accent">1942 战区</span>
            <h2>诺曼底滩头</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="关闭战术地图"
          >
            <X size={23} />
          </button>
        </div>
      )}
      <svg
        viewBox="0 0 200 200"
        aria-label="显示小队和敌人位置的战术地图"
      >
        <defs>
          <pattern
            id={large ? "map-grid-large" : "map-grid-small"}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#a7b196"
              strokeWidth=".25"
              opacity=".3"
            />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="#303d39" />
        <path
          d="M10 25 36 9 74 14 84 5 125 11 152 5 185 30 194 85 181 124 193 171 165 191 124 182 73 194 30 180 7 139 18 99Z"
          fill="#52604a"
        />
        <path
          d="m27 42 22-17 17 16 32-5 25-9 44 21 8 40-14 33 10 35-47 16-27-9-40 6-26-32 9-30-16-34Z"
          fill="#62684d"
        />
        <path
          d="M104 17 82 55 98 92 78 129 100 180M16 119 62 105 106 120 164 90 190 100"
          fill="none"
          stroke="#c2ae77"
          strokeWidth="5"
          opacity=".35"
        />
        <rect
          width="200"
          height="200"
          fill={`url(#${large ? "map-grid-large" : "map-grid-small"})`}
        />
        {[
          [-19, -14, 10, 10],
          [19, -16, 10, 9],
          [-29, 12, 8, 11],
          [27, 14, 8, 10],
          [-2, -31, 13, 7],
          [-42, -34, 10, 8],
          [39, -34, 8, 9],
        ].map(([x, z, w, d], i) => (
          <rect
            key={i}
            x={scale(x - w / 2)}
            y={scale(z - d / 2)}
            width={w * 1.5}
            height={d * 1.5}
            fill="#b5b7a1"
            stroke="#d6d4b1"
            strokeWidth=".6"
          />
        ))}
        <circle cx={100} cy={scale(-7)} r="7" fill="#a5ac94" stroke="#d1c8a0" />
        <circle
          cx="100"
          cy="100"
          r={(state.ringRadius / 134) * 200}
          fill="none"
          stroke="#d8e593"
          strokeWidth="1.2"
          opacity=".8"
        />
        {state.entities
          .filter((e) => e.alive)
          .map((e) => (
            <g key={e.id} transform={`translate(${scale(e.x)},${scale(e.z)})`}>
              {e.ally ? (
                <path d="M0-3 3 2-3 2Z" fill="#b1d5cd" />
              ) : (
                <rect
                  x="-1.8"
                  y="-1.8"
                  width="3.6"
                  height="3.6"
                  fill="#e5a67f"
                  transform="rotate(45)"
                />
              )}
            </g>
          ))}
        <g
          transform={`translate(${scale(state.x)},${scale(state.z)}) rotate(${(-state.yaw * 180) / Math.PI})`}
        >
          <path d="M0-22 14-5 0 0-14-5Z" fill="#dfef99" opacity=".13" />
          <path
            d="M0-5 4 4 0 2-4 4Z"
            fill="#e7f5b0"
            stroke="#263635"
            strokeWidth=".7"
          />
        </g>
        <text
          x="100"
          y="12"
          textAnchor="middle"
          fontSize="7"
          fill="#e1e5c9"
          fontFamily="monospace"
        >
          N
        </text>
      </svg>
      {large ? (
        <div className="map-competitor">
          <span>
            <i className="map-you" />
            你
          </span>
          <span>
            <i className="map-ally" />
            小队
          </span>
          <span>
            <i className="map-rival" />
            敌军
          </span>
          <span>炮击圈 {Math.round(state.ringRadius)}m</span>
        </div>
      ) : (
        <div className="map-location">
          <span>诺曼底滩头</span>
          <MapTrifold size={12} />
        </div>
      )}
    </div>
  );
}

function ActionKey({
  label,
  hotkey,
  cooldown,
  icon,
  onClick,
  percent,
}: {
  label: string;
  hotkey: string;
  cooldown?: number;
  icon: React.ReactNode;
  onClick: () => void;
  percent?: number;
}) {
  const unavailable =
    (cooldown ?? 0) > 0 || (percent !== undefined && percent < 100);
  return (
    <button
      className={`action-key ${unavailable ? "cooling" : ""} ${percent === 100 ? "ultimate-ready" : ""}`}
      aria-label={`${label}${unavailable ? " 冷却中" : ""}`}
      onClick={onClick}
      title={`${hotkey} · ${label}`}
    >
      <span className="action-hotkey">{hotkey}</span>
      <span className="action-icon">
        {cooldown && cooldown > 0 ? <b>{Math.ceil(cooldown)}</b> : icon}
      </span>
      {percent !== undefined && (
        <span className="ultimate-percent">{Math.floor(percent)}%</span>
      )}
      <span className="action-label">{label}</span>
    </button>
  );
}

export function Hud({
  state,
  options,
  engine,
  portraits,
  onPause,
  onMap,
  onEndTraining,
}: {
  state: GameSnapshot;
  options: MatchOptions;
  engine: RelayEngine | null;
  portraits: Record<LegendId, string> | null;
  onPause: () => void;
  onMap: () => void;
  onEndTraining: () => void;
}) {
  const competitor = COMPETITORS.find((l) => l.id === options.competitor)!;
  const weapon = WEAPONS.find((w) => w.id === options.weapon)!;
  const degrees =
    ((Math.round((-state.yaw * 180) / Math.PI) % 360) + 360) % 360;
  const direction = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(degrees / 45) % 8
  ];
  return (
    <div
      className={`hud ${state.aiming ? "aiming" : ""} ${state.activeAbility > 0 ? "ability-active" : ""}`}
      aria-hidden={state.phase === "paused"}
      inert={state.phase === "paused"}
    >
      <div
        className={`damage-vignette ${state.damageFlash > 0 ? "visible" : ""}`}
        style={{
          opacity:
            state.damageFlash > 0 ? Math.min(1, state.damageFlash * 3) : 0,
        }}
      />
      {options.competitor === "tavi" && state.activeAbility > 0 && (
        <div className="phase-vignette" />
      )}
      <div className="hud-top-left">
        <button
          className="minimap-button"
          onClick={onMap}
          aria-label="打开战术地图"
        >
          <TacticalMap state={state} />
        </button>
        <div className="ring-timer">
          <span>
            <span className="status-dot" />
            {options.mode === "training"
              ? "练习模式"
              : state.time < 45
                ? "炮击圈收缩倒计时"
                : "炮击圈正在收缩"}
          </span>
          <strong>
            {options.mode === "training"
              ? formatTime(state.time)
              : state.time < 45
                ? formatTime(45 - state.time)
                : formatTime(180 - state.time)}
          </strong>
        </div>
      </div>
      <div className="compass">
        <div className="compass-ticks">
          <span>{(degrees + 330) % 360}</span>
          <span className="tick" />
          <span>{(degrees + 345) % 360}</span>
          <span className="tick" />
          <b>{direction}</b>
          <span className="tick" />
          <span>{(degrees + 15) % 360}</span>
          <span className="tick" />
          <span>{(degrees + 30) % 360}</span>
        </div>
        <span className="compass-pointer" />
        <strong>{degrees}</strong>
      </div>
      <div className="hud-top-right">
        <div className="match-counters">
          <span>
            <UsersThree size={17} />
            <b>
              {options.mode === "training"
                ? state.remaining
                : Math.ceil(state.remaining / 3) + 1}
            </b>
            <small>
              {options.mode === "training" ? "靶标" : "剩余小队"}
            </small>
          </span>
          <span>
            <Skull size={17} />
            <b>{state.kills}</b>
          </span>
          <button onClick={onPause} aria-label="暂停游戏">
            <Pause size={19} weight="fill" />
          </button>
        </div>
        <div className="kill-feed">
          {state.feed
            .filter((f) => state.time - f.time < 8)
            .map((f) => (
              <div key={f.id} className={f.ally ? "friendly" : ""}>
                {f.text}
              </div>
            ))}
        </div>
      </div>
      {state.entities
        .filter(
          (e) =>
            e.alive &&
            e.screenX !== undefined &&
            e.screenY !== undefined &&
            e.screenX > 4 &&
            e.screenX < 96 &&
            e.screenY > 8 &&
            e.screenY < 80,
        )
        .map((e) => (
          <div
            className={`entity-label ${e.ally ? "ally" : "enemy"}`}
            key={e.id}
            style={{ left: `${e.screenX}%`, top: `${e.screenY}%` }}
          >
            <span>
              {e.ally ? (
                <Shield size={10} weight="fill" />
              ) : (
                <Target size={10} />
              )}{" "}
              {e.name}
            </span>
            <div>
              <i style={{ transform: `scaleX(${e.health / e.maxHealth})` }} />
            </div>
          </div>
        ))}
      <div
        className={`crosshair ${state.hit > 0 ? "hit" : ""} ${state.sprinting ? "sprint" : ""}`}
      >
        <i />
        <i />
        <i />
        <i />
        <span />
      </div>
      {state.hit > 0 && <div className="damage-number">{state.lastDamage}</div>}
      {state.reloading > 0 && (
        <div className="reload-indicator">
          <span className="keycap">R</span> 正在换弹{" "}
          <span>{state.reloading.toFixed(1)}s</span>
        </div>
      )}
      {state.outOfRing && (
        <div className="ring-warning">
          <Warning size={22} weight="fill" /> 快回到炮击圈内
        </div>
      )}
      {state.messageTime > 0 && (
        <div className="game-message" key={state.message}>
          <span className="tiny-square" />
          {state.message}
        </div>
      )}
      <div className="hud-bottom-left">
        <div className="teammate-hud">
          {state.entities
            .filter((e) => e.ally)
            .map((e, i) => (
              <div className={e.alive ? "" : "eliminated"} key={e.id}>
                <Portrait id={i === 0 ? "boren" : "nima"} portraits={portraits} />
                <div>
                  <span>
                    {e.name}
                    {e.alive ? <Check size={10} /> : <Skull size={10} />}
                  </span>
                  <div className="teammate-health">
                    <i
                      style={{ transform: `scaleX(${e.health / e.maxHealth})` }}
                    />
                  </div>
                </div>
                <small>AI</small>
              </div>
            ))}
        </div>
        <div className="player-vitals">
          <div className="player-portrait">
            <Portrait id={competitor.id} portraits={portraits} />
            <LegendIcon id={competitor.id} size={16} />
          </div>
          <div className="vitals-details">
            <div className="vitals-name">
              <strong>列兵-01</strong>
              <span>{competitor.name}</span>
            </div>
            <div className="shield-bar">
              <Shield size={12} weight="fill" />
              <div>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i}>
                    <i
                      style={{
                        transform: `scaleX(${Math.max(0, Math.min(1, (state.shield / state.maxShield) * 5 - i))})`,
                      }}
                    />
                  </span>
                ))}
              </div>
              <b>{Math.ceil(state.shield)}</b>
            </div>
            <div className="health-bar">
              <span>
                <i style={{ transform: `scaleX(${state.health / 100})` }} />
              </span>
              <b>{Math.ceil(state.health)}</b>
            </div>
          </div>
        </div>
      </div>
      <div className="hud-actions">
        <ActionKey
          label="医疗包"
          hotkey="E"
          cooldown={state.healCooldown}
          icon={<FirstAid size={24} />}
          onClick={() => engine?.action("heal")}
        />
        <span className="action-separator" />
        <ActionKey
          label={competitor.ability}
          hotkey="Q"
          cooldown={state.abilityCooldown}
          icon={<LegendIcon id={competitor.id} size={27} />}
          onClick={() => engine?.action("tactical")}
        />
        <ActionKey
          label={competitor.ultimate}
          hotkey="Z"
          percent={state.ultimate}
          icon={<Lightning size={25} weight="fill" />}
          onClick={() => engine?.action("ultimate")}
        />
        <span className="action-separator" />
        <ActionKey
          label="手榴弹"
          hotkey="G"
          cooldown={state.grenadeCooldown}
          icon={<Crosshair size={24} />}
          onClick={() => engine?.action("grenade")}
        />
      </div>
      <div className="weapon-hud">
        <div className="weapon-hud-name">
          <span>{weapon.name}</span>
          <span className="keycap">1</span>
        </div>
        <WeaponSilhouette variant={weapon.id} />
        <div className={`ammo-counter ${state.ammo < 6 ? "low-ammo" : ""}`}>
          <span>{String(state.ammo).padStart(2, "0")}</span>
          <i>/</i>
          <small>∞</small>
          <button
            aria-label="装填武器"
            onClick={() => engine?.action("reload")}
          >
            <span className="keycap">R</span>换弹
          </button>
        </div>
        <div className="ammo-bars">
          {Array.from({ length: Math.min(state.maxAmmo, 28) }, (_, i) => (
            <i key={i} className={i < state.ammo ? "full" : ""} />
          ))}
        </div>
      </div>
      <div className="hud-bottom-hints">
        <span>
          <span className="keycap">SHIFT</span>疾跑{" "}
          <span className="keycap">空格</span>跳跃{" "}
          <span className="keycap">C</span>滑铲
        </span>
        {options.mode === "training" ? (
          <button onClick={onEndTraining}>
            <Flag size={12} /> 结束练习
          </button>
        ) : (
          <span>消灭所有敌方小队</span>
        )}
        <span>
          {state.fps} FPS <span className="status-dot" />
        </span>
      </div>
      {state.phase === "countdown" && (
        <div className="countdown-overlay">
          <BrandMark />
          <p>
            {options.mode === "training" ? "靶场训练" : "小队突围"}
          </p>
          <strong key={Math.ceil(state.countdown)}>
            {Math.ceil(state.countdown)}
          </strong>
          <span>
            {options.mode === "training"
              ? "感受你的火力。"
              : "紧跟队友，全力出击。"}
          </span>
          <small>WASD 移动 · 鼠标控制视角 · 左键开火</small>
        </div>
      )}
      <TouchControls engine={engine} onMap={onMap} />
    </div>
  );
}

function TouchControls({
  engine,
  onMap,
}: {
  engine: RelayEngine | null;
  onMap: () => void;
}) {
  const stick = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    const dx = event.clientX - origin.current.x,
      dy = event.clientY - origin.current.y;
    const dist = Math.max(42, Math.hypot(dx, dy));
    const x = dx / dist,
      y = dy / dist;
    engine?.setTouchMove(x, y);
    if (stick.current)
      stick.current.style.transform = `translate(${x * 34}px,${y * 34}px)`;
  };
  const reset = () => {
    origin.current = null;
    engine?.setTouchMove(0, 0);
    if (stick.current) stick.current.style.transform = "translate(0,0)";
  };
  return (
    <div className="touch-controls">
      <div
        className="touch-stick"
        role="application"
        aria-label="移动摇杆"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          origin.current = {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          };
          update(e);
        }}
        onPointerMove={update}
        onPointerUp={reset}
        onPointerCancel={reset}
      >
        <div ref={stick}>
          <ArrowsOut size={20} />
        </div>
      </div>
      <button
        className="touch-fire"
        aria-label="武器开火"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          engine?.setTouchFire(true);
        }}
        onPointerUp={() => engine?.setTouchFire(false)}
        onPointerCancel={() => engine?.setTouchFire(false)}
      >
        <Crosshair size={31} />
      </button>
      <button
        className="touch-jump"
        aria-label="跳跃"
        onClick={() => engine?.action("jump")}
      >
        <ArrowUp size={25} />
      </button>
      <button className="touch-map" aria-label="战术地图" onClick={onMap}>
        <MapTrifold size={22} />
      </button>
    </div>
  );
}
