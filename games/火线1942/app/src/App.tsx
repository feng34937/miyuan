import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  Crosshair,
  Diamond,
  Flag,
  GameController,
  GearSix,
  Info,
  Lightning,
  Play,
  Shield,
  Skull,
  SpeakerHigh,
  Target,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react";
import { BrandMark, LegendIcon } from "./components/Icons";
import { Lobby, ModePicker, Portrait } from "./components/Lobby";
import { Hud, TacticalMap } from "./components/Hud";
import { Modal } from "./components/Modal";
import { CHALLENGES, CONTROLS, SKINS } from "./game/config";
import {
  formatTime,
  readProfile,
  readSettings,
  recordMatch,
  saveLocal,
} from "./game/rules";
import type { RelayEngine } from "./game/engine";
import type {
  GameSnapshot,
  LegendId,
  MatchOptions,
  MatchResult,
  ModeId,
  Profile,
  Settings,
  ViewId,
  WeaponId,
} from "./game/types";

type ModalType =
  | "settings"
  | "controls"
  | "about"
  | "squad"
  | "mode"
  | "challenges"
  | "skin"
  | null;
const initialSnapshot: GameSnapshot = {
  phase: "lobby",
  countdown: 3,
  health: 100,
  shield: 75,
  maxShield: 75,
  ammo: 28,
  maxAmmo: 28,
  reloading: 0,
  kills: 0,
  assists: 0,
  damage: 0,
  remaining: 9,
  time: 0,
  ringRadius: 67,
  abilityCooldown: 0,
  healCooldown: 0,
  grenadeCooldown: 0,
  ultimate: 35,
  activeAbility: 0,
  hit: 0,
  damageFlash: 0,
  lastDamage: 0,
  aiming: false,
  sprinting: false,
  x: 0,
  z: 38,
  yaw: 0,
  outOfRing: false,
  feed: [],
  entities: [],
  message: "",
  messageTime: 0,
  fps: 60,
  locked: false,
};

function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  );
  const first = buttons[0],
    last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export default function App() {
  const canvasContainer = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RelayEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [view, setView] = useState<ViewId>("play");
  const [mode, setMode] = useState<ModeId>("squads");
  const [modal, setModal] = useState<ModalType>(null);
  const [skinTarget, setSkinTarget] = useState("sandstorm");
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [portraits, setPortraits] = useState<Record<LegendId, string> | null>(
    null,
  );
  const [showMap, setShowMap] = useState(false);
  const [matchOptions, setMatchOptions] = useState<MatchOptions>({
    competitor: profile.selectedLegend,
    weapon: profile.selectedWeapon,
    mode,
    skin: profile.skin,
  });
  const [toast, setToast] = useState("");
  const initialSettings = useRef(settings);
  const initialProfile = useRef(profile);
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    let cancelled = false;
    let instance: RelayEngine | null = null;
    import("./game/engine")
      .then(({ RelayEngine }) => {
        if (cancelled || !canvasContainer.current) return;
        try {
          instance = new RelayEngine(
            canvasContainer.current,
            initialSettings.current,
            (s) =>
              setSnapshot((previous) =>
                previous.phase === "lobby" && s.phase === "lobby"
                  ? previous
                  : s,
              ),
            (r) => {
              setResult(r);
              setProfile((p) => recordMatch(p, r));
            },
            setShowMap,
            setError,
          );
          engineRef.current = instance;
          const p = initialProfile.current;
          instance.setSelection(p.selectedLegend, p.selectedWeapon, p.skin);
          setPortraits(instance.createPortraits());
          setReady(true);
        } catch (e) {
          console.error(e);
          setError(
            "你的浏览器无法启动 3D 战场。请启用硬件加速后刷新重试。",
          );
        }
      })
      .catch(() =>
        setError(
          "战场加载失败。请检查网络连接后刷新。",
        ),
      );
    return () => {
      cancelled = true;
      instance?.dispose();
      engineRef.current = null;
    };
  }, []);
  useEffect(() => {
    saveLocal("windward-relay-profile-v1", profile);
    engineRef.current?.setSelection(
      profile.selectedLegend,
      profile.selectedWeapon,
      profile.skin,
    );
  }, [profile, ready]);
  useEffect(() => {
    saveLocal("windward-relay-settings-v1", settings);
    engineRef.current?.updateSettings(settings);
  }, [settings]);
  useEffect(() => {
    engineRef.current?.setView(view);
  }, [view, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const start = () => {
    if (!engineRef.current || !ready) return;
    const options = {
      competitor: profile.selectedLegend,
      weapon: profile.selectedWeapon,
      mode,
      skin: profile.skin,
    };
    setMatchOptions(options);
    setModal(null);
    setResult(null);
    setShowMap(false);
    engineRef.current.start(options);
  };
  const returnLobby = () => {
    engineRef.current?.returnToLobby();
    setResult(null);
    setShowMap(false);
    setModal(null);
  };
  const selectLegend = (competitor: LegendId) =>
    setProfile((p) => ({ ...p, selectedLegend: competitor }));
  const selectWeapon = (weapon: WeaponId) =>
    setProfile((p) => ({ ...p, selectedWeapon: weapon }));
  const selectSkin = (skin: string) => {
    if (profile.unlockedSkins.includes(skin)) {
      setProfile((p) => ({ ...p, skin }));
    } else {
      setSkinTarget(skin);
      setModal("skin");
    }
  };
  const claimChallenge = (id: string) => {
    const c = CHALLENGES.find((c) => c.id === id);
    if (
      !c ||
      profile[c.field] < c.target ||
      profile.claimedChallenges.includes(id)
    )
      return;
    setProfile((p) =>
      p.claimedChallenges.includes(id)
        ? p
        : {
            ...p,
            credits: p.credits + c.reward,
            claimedChallenges: [...p.claimedChallenges, id],
          },
    );
    setToast(`任务完成 · +${c.reward} 军需点`);
  };
  const buySkin = () => {
    const skin = SKINS.find((s) => s.id === skinTarget);
    if (!skin || profile.credits < skin.cost) return;
    setProfile((p) =>
      p.unlockedSkins.includes(skin.id)
        ? { ...p, skin: skin.id }
        : {
            ...p,
            credits: p.credits - skin.cost,
            unlockedSkins: [...p.unlockedSkins, skin.id],
            skin: skin.id,
          },
    );
    setModal(null);
    setToast(`${skin.name} 已解锁并装备`);
  };
  const isLobby = snapshot.phase === "lobby";

  return (
    <div
      className={`app ${ready ? "is-ready" : ""} ${isLobby ? "in-lobby" : "in-game"}`}
    >
      <div className="world-canvas" ref={canvasContainer} />
      {!ready && !error && (
        <div className="loading-arena">
          <BrandMark />
          <div>
            <span>火线1942</span>
            <p>正在进入战场</p>
            <div className="loading-track">
              <i />
            </div>
          </div>
        </div>
      )}
      {isLobby && (
        <Lobby
          view={view}
          setView={setView}
          profile={profile}
          settings={settings}
          portraits={portraits}
          mode={mode}
          setLegend={selectLegend}
          setWeapon={selectWeapon}
          setSkin={selectSkin}
          onStart={start}
          onMode={() => setModal("mode")}
          onSettings={() => setModal("settings")}
          onControls={() => setModal("controls")}
          onAbout={() => setModal("about")}
          onSquad={() => setModal("squad")}
          onChallenges={() => setModal("challenges")}
          onClaim={claimChallenge}
          onSound={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
          ready={ready}
        />
      )}
      {!isLobby && snapshot.phase !== "ended" && (
        <Hud
          state={snapshot}
          options={matchOptions}
          engine={engineRef.current}
          portraits={portraits}
          onPause={() => engineRef.current?.pause()}
          onMap={() => setShowMap((s) => !s)}
          onEndTraining={() => engineRef.current?.finishTraining()}
        />
      )}
      {showMap && !isLobby && snapshot.phase !== "ended" && (
        <div
          className="map-overlay"
          onClick={(e) => {
            if (e.currentTarget === e.target) setShowMap(false);
          }}
        >
          <TacticalMap
            state={snapshot}
            large
            onClose={() => setShowMap(false)}
          />
        </div>
      )}
      {snapshot.phase === "paused" && !modal && (
        <div className="pause-overlay">
          <div
            className="pause-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
            data-game-pause
            onKeyDown={trapDialogFocus}
          >
            <BrandMark />
            <p className="eyebrow text-accent">稍作休整。</p>
            <h1 id="pause-title">
              我们会为你
              <br />
              守住阵地。
            </h1>
            <p>战斗已暂停。小队随时待命。</p>
            <button
              className="primary-button"
              autoFocus
              onClick={() => engineRef.current?.resume()}
            >
              <Play size={19} weight="fill" /> 重返战斗{" "}
              <ArrowRight size={20} />
            </button>
            <button
              className="secondary-button"
              onClick={() => setModal("settings")}
            >
              <GearSix size={18} /> 设置
            </button>
            <button
              className="secondary-button"
              onClick={() => setModal("controls")}
            >
              <GameController size={18} /> 操作说明
            </button>
            {matchOptions.mode === "training" && (
              <button
                className="secondary-button"
                onClick={() => engineRef.current?.finishTraining()}
              >
                <Flag size={18} /> 结束练习
              </button>
            )}
            <button className="text-link" onClick={returnLobby}>
              离开战场 <ArrowUpRight size={14} />
            </button>
            <span className="pause-hint">
              <span className="keycap">ESC</span> 继续战斗
            </span>
          </div>
        </div>
      )}
      {result && (
        <div className="results-overlay">
          <div
            className={`results-panel ${result.reason === "champion" ? "victory" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="比赛结果"
            onKeyDown={trapDialogFocus}
          >
            <div className="results-eyebrow">
              <span />{" "}
              {result.mode === "training"
                ? "练习完成"
                : "战斗结束"}{" "}
              <span />
            </div>
            <div className="result-emblem">
              {result.reason === "champion" ? (
                <Trophy size={62} weight="thin" />
              ) : result.mode === "training" ? (
                <Crosshair size={62} weight="thin" />
              ) : (
                <BrandMark />
              )}
            </div>
            <p className="eyebrow">
              {result.reason === "champion"
                ? "你来了。你战斗了。你胜利了。"
                : result.mode === "training"
                  ? "枪法更准了。身手更快了。"
                  : result.reason === "timeout"
                    ? "炮火决定了最终结局。"
                    : "每位英雄都有起点。"}
            </p>
            <h1>
              {result.reason === "champion"
                ? "胜利"
                : result.mode === "training"
                  ? "随时再战。"
                  : "下一场战斗等着你。"}
            </h1>
            <p className="result-subtitle">
              {result.reason === "champion"
                ? "整个前线都记住了你的名字。"
                : result.mode === "training"
                  ? "把学到的本领带上战场。"
                  : "重整队伍。装填弹药。改写结局。"}
            </p>
            <div className="result-stats">
              <div>
                <Skull size={20} />
                <strong>{result.kills}</strong>
                <span>击毙数</span>
              </div>
              <div>
                <Target size={20} />
                <strong>{result.damage.toLocaleString()}</strong>
                <span>造成伤害</span>
              </div>
              <div>
                <UsersThree size={20} />
                <strong>{result.assists}</strong>
                <span>助攻数</span>
              </div>
              <div>
                <Flag size={20} />
                <strong>{formatTime(result.duration)}</strong>
                <span>存活时间</span>
              </div>
            </div>
            {result.mode === "squads" && (
              <div className="result-rewards">
                <span>
                  <span className="placement">#{result.placement}</span> 小队
                  排名
                </span>
                <span>+{result.xp} 经验值</span>
                <span>
                  <Diamond size={17} />
                  {result.credits} 军需点
                </span>
              </div>
            )}
            <div className="result-buttons">
              <button
                className="secondary-button"
                autoFocus
                onClick={returnLobby}
              >
                返回指挥部
              </button>
              <button className="primary-button" onClick={start}>
                再战一局 <ArrowRight size={19} />
              </button>
            </div>
            <p className="saved-notice">
              <CheckCircle size={12} />{" "}
              {result.mode === "training"
                ? "练习本身就是收获。"
                : "生涯进度已保存在此设备上。"}
            </p>
          </div>
        </div>
      )}

      {modal === "mode" && (
        <Modal
          title="选择战场"
          eyebrow="前线已经开放"
          onClose={closeModal}
          wide
        >
          <ModePicker
            mode={mode}
            onSelect={(m) => {
              setMode(m);
              setModal(null);
            }}
          />
          <p className="modal-footnote">
            <Info size={14} /> 打开浏览器即可开战。队友和敌军均由电脑控制。
          </p>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="调到最顺手"
          eyebrow="设置"
          onClose={closeModal}
        >
          <div className="settings-content">
            <div className="settings-section">
              <h3>
                <Crosshair size={17} /> 游戏设置
              </h3>
              <label className="range-setting">
                <span>
                  鼠标灵敏度 <strong>{settings.sensitivity}</strong>
                </span>
                <input
                  aria-label="鼠标灵敏度"
                  type="range"
                  min="10"
                  max="100"
                  value={settings.sensitivity}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      sensitivity: Number(e.target.value),
                    }))
                  }
                />
                <small>数值越低，瞄准控制越精细。</small>
              </label>
              <label className="toggle-setting">
                <span>
                  反转垂直视角
                  <small>反转鼠标上下移动的视角方向。</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.invertY}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, invertY: e.target.checked }))
                  }
                />
                <i />
              </label>
            </div>
            <div className="settings-section">
              <h3>
                <SpeakerHigh size={17} /> 音频
              </h3>
              <label className="toggle-setting">
                <span>
                  游戏音效
                  <small>枪声、技能音效与战斗反馈。</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, sound: e.target.checked }))
                  }
                />
                <i />
              </label>
              <label className="range-setting">
                <span>
                  主音量 <strong>{settings.volume}%</strong>
                </span>
                <input
                  aria-label="主音量"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.volume}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      volume: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="settings-section">
              <h3>
                <GearSix size={17} /> 显示
              </h3>
              <label className="select-setting">
                <span>
                  画质
                  <small>选择性能模式可减轻渲染负担。</small>
                </span>
                <select
                  aria-label="画质"
                  value={settings.quality}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      quality: e.target.value as Settings["quality"],
                    }))
                  }
                >
                  <option value="high">高画质</option>
                  <option value="low">性能</option>
                </select>
              </label>
            </div>
            <div className="settings-footer">
              <span>
                <CheckCircle size={14} /> 更改已自动保存
              </span>
              <button
                className="text-link"
                onClick={() =>
                  setSettings({
                    sensitivity: 45,
                    volume: 55,
                    quality: "high",
                    sound: true,
                    invertY: false,
                  })
                }
              >
                恢复默认设置
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "controls" && (
        <Modal
          title="熟悉战场"
          eyebrow="玩法说明"
          onClose={closeModal}
          wide
        >
          <div className="controls-intro">
            <Target size={27} />
            <p>
              在炮击圈完全收缩前，消灭全部 3 支敌方小队。
              利用掩体，紧跟队友，用技能扭转战局。
            </p>
          </div>
          <div className="controls-grid">
            {CONTROLS.map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <div className="controls-notes">
            <p>
              <Shield size={17} />
              <span>
                连续 8 秒未受伤害后，护甲会开始恢复。拾取战场上的
                补给箱可立即恢复生命与护甲。
              </span>
            </p>
            <p>
              <Lightning size={17} />
              <span>
                终极技能随时间充能，造成伤害可加快充能。
                多用 Q，技能冷却后会恢复。
              </span>
            </p>
            <p>
              <GameController size={17} />
              <span>
                使用触屏时，通过左侧摇杆移动，拖动画面调整视角，
                点击动作按钮进行战斗。
              </span>
            </p>
          </div>
          <button className="primary-button controls-done" onClick={closeModal}>
            明白了，出发！ <ArrowRight size={19} />
          </button>
        </Modal>
      )}
      {modal === "squad" && (
        <Modal
          title="可靠的战友，凶狠的来意。"
          eyebrow="你的小队"
          onClose={closeModal}
        >
          <p className="modal-description">
            你将与两名电脑队友一同出战。他们会跟随你的指挥，
            迎击附近的敌人，在交火时为你提供掩护。
          </p>
          <div className="squad-detail-list">
            {[
              {
                id: profile.selectedLegend,
                name: "列兵-01",
                role: "小队队长",
                desc: "由你发号施令。选好路线，小队便会跟上。",
              },
              {
                id: "boren" as const,
                name: "磐石",
                role: "支援兵 · 电脑",
                desc: "临危不乱。磐石负责吸引敌方火力，坚守前线。",
              },
              {
                id: "nima" as const,
                name: "猎鹰",
                role: "侦察兵 · 电脑",
                desc: "你的另一双眼睛。猎鹰紧随左右，压制暴露的敌人。",
              },
            ].map((member) => (
              <div key={member.name}>
                <Portrait id={member.id} portraits={portraits} />
                <div>
                  <span className="eyebrow text-accent">{member.role}</span>
                  <h3>{member.name}</h3>
                  <p>{member.desc}</p>
                </div>
                <LegendIcon id={member.id} />
              </div>
            ))}
          </div>
          <div className="squad-tip">
            <UsersThree size={22} />
            <p>
              与队友保持在 8 米以内，便于获得火力支援。
              布鲁克的终极技能可恢复友军生命。
            </p>
          </div>
        </Modal>
      )}
      {modal === "about" && (
        <Modal
          title="欢迎来到火线1942"
          eyebrow="战地简报 / 001"
          onClose={closeModal}
          wide
        >
          <div className="field-guide">
            <div className="guide-art">
              <BrandMark />
              <span>
                欧洲战区
                <br />
                前线指挥部
              </span>
              <small>1942 / 诺曼底</small>
            </div>
            <div className="guide-copy">
              <p className="guide-lead">
                地图的边缘。
                <br />
                你传奇的开始。
              </p>
              <p>
                诺曼底的这片滩头曾是个安静的渔村。如今，炸毁的坦克、
                沙袋工事和废弃的营房，成了最激烈交火的舞台。
              </p>
              <p>
                选择一名士兵，整装出发，带领小队投入一场三分钟的战斗。
                你与胜利之间，还隔着九名敌军。炮击圈可不会等你。
              </p>
              <div className="guide-pillars">
                <span>
                  <UsersThree size={18} /> 集结小队
                </span>
                <span>
                  <Lightning size={18} /> 发挥所长
                </span>
                <span>
                  <Trophy size={18} /> 夺取胜利
                </span>
              </div>
              <p className="guide-note">
                一款受二战射击游戏启发的原创浏览器枪战游戏。无需下载、
                注册账号或花费真钱。你的生涯进度和赢得的涂装都保存在此设备上。
              </p>
            </div>
          </div>
          <button className="primary-button guide-done" onClick={closeModal}>
            奔赴前线 <ArrowRight size={20} />
          </button>
        </Modal>
      )}
      {modal === "challenges" && (
        <Modal
          title="多一个奋战的理由"
          eyebrow="战地任务"
          onClose={closeModal}
        >
          <p className="modal-description">
            通过小队比赛和战地任务赚取军需点，
            为你的士兵解锁战地涂装。
          </p>
          <div className="objectives-list">
            {CHALLENGES.map((c) => {
              const value = Math.min(profile[c.field], c.target),
                done = value >= c.target,
                claimed = profile.claimedChallenges.includes(c.id);
              return (
                <div key={c.id}>
                  <div className="objective-top">
                    <Target size={22} />
                    <span>
                      <strong>{c.title}</strong>
                      <small>{c.description}</small>
                    </span>
                    <span className="objective-reward">
                      <Diamond size={13} />
                      {c.reward}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i style={{ transform: `scaleX(${value / c.target})` }} />
                  </div>
                  <div className="objective-bottom">
                    <span>
                      {value.toLocaleString()} / {c.target.toLocaleString()}
                    </span>
                    <button
                      disabled={!done || claimed}
                      onClick={() => claimChallenge(c.id)}
                      className={done ? "text-accent" : ""}
                    >
                      {claimed ? (
                        <>
                          <Check size={13} />
                          CLAIMED
                        </>
                      ) : done ? (
                        "领取奖励"
                      ) : (
                        "进行中"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {modal === "skin" && (
        <Modal
          title="别样的个性宣言"
          eyebrow="战地涂装"
          onClose={closeModal}
        >
          <div className="skin-purchase">
            <span
              className="large-swatch"
              style={{
                background: SKINS.find((s) => s.id === skinTarget)?.color,
              }}
            >
              <BrandMark />
            </span>
            <h3>{SKINS.find((s) => s.id === skinTarget)?.name}</h3>
            <p>
              为全部三名士兵换上全新军装涂装。
              <br />
              仅改变外观。完全属于你。
            </p>
            <div>
              <span>你的余额</span>
              <strong>
                <Diamond size={17} />
                {profile.credits}
              </strong>
            </div>
            <button
              className="primary-button"
              disabled={
                profile.credits <
                (SKINS.find((s) => s.id === skinTarget)?.cost ?? 0)
              }
              onClick={buySkin}
            >
              <Diamond size={19} /> 花费{" "}
              {SKINS.find((s) => s.id === skinTarget)?.cost} 军需点解锁{" "}
              <ArrowRight size={19} />
            </button>
            {profile.credits <
              (SKINS.find((s) => s.id === skinTarget)?.cost ?? 0) && (
              <small>
                完成比赛和战地任务，赚取更多军需点。
              </small>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={18} weight="fill" />
          {toast}
        </div>
      )}
      {error && (
        <div className="error-overlay">
          <div>
            <BrandMark />
            <h1>连接中断</h1>
            <p>{error}</p>
            <button
              className="primary-button"
              onClick={() => location.reload()}
            >
              重新加载战场 <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
