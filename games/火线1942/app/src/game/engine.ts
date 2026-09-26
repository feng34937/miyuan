import * as THREE from "three";
import { GameAudio } from "./audio";
import { COMPETITORS, WEAPONS } from "./config";
import {
  animateCharacter,
  createCharacter,
  createWeapon,
  setFastMaterials,
} from "./models";
import type { CharacterModel } from "./models";
import { applyDamage, clamp, resolveMovement, rewards, ringAt } from "./rules";
import { createWorld, mergeStatic } from "./world";
import type { World } from "./world";
import type {
  GameSnapshot,
  LegendId,
  MatchOptions,
  MatchResult,
  Settings,
  ViewId,
  WeaponId,
  FinishReason,
} from "./types";

interface Bot {
  id: string;
  name: string;
  model: CharacterModel;
  x: number;
  z: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  ally: boolean;
  cooldown: number;
  seed: number;
  respawn: number;
  lastHit: number;
  speed: number;
  targetOffset: number;
}
interface Effect {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
  type: "tracer" | "burst" | "ring";
}

export const INITIAL_SNAPSHOT: GameSnapshot = {
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
  ultimate: 0,
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

const UP = new THREE.Vector3(0, 1, 0);
const ray = new THREE.Raycaster();
const vec = new THREE.Vector3();
const botNames = [
  "秃鹫",
  "毒刺",
  "铁十字",
  "猎犬",
  "夜枭",
  "豺狼",
  "灰狼",
  "眼镜蛇",
  "黑豹",
];

function optimizeModel(model: CharacterModel) {
  for (const g of [
    model.head,
    model.leftArm,
    model.rightArm,
    model.leftLeg,
    model.rightLeg,
  ])
    mergeStatic(g);
  model.torso.remove(model.leftArm, model.rightArm);
  mergeStatic(model.torso);
  model.torso.add(model.leftArm, model.rightArm);
  model.group.remove(model.head, model.torso, model.leftLeg, model.rightLeg);
  mergeStatic(model.group);
  model.group.add(model.head, model.torso, model.leftLeg, model.rightLeg);
}

function releaseGeometry(group: THREE.Object3D) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  group.removeFromParent();
}

export class RelayEngine {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private camera: THREE.PerspectiveCamera;
  private weaponScene = new THREE.Scene();
  private weaponCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  private weaponModel: THREE.Group;
  private showcaseWeapon: THREE.Group;
  private hero: CharacterModel;
  private bots: Bot[] = [];
  private effects: Effect[] = [];
  private frame = 0;
  private lastFrame = 0;
  private elapsed = 0;
  private publishElapsed = 0;
  private settings: Settings;
  private audio: GameAudio;
  private options: MatchOptions = {
    competitor: "tavi",
    weapon: "carbine",
    mode: "squads",
    skin: "carbon",
  };
  private state: GameSnapshot = { ...INITIAL_SNAPSHOT, feed: [], entities: [] };
  private keys = new Set<string>();
  private trigger = false;
  private rightMouse = false;
  private yaw = 0;
  private pitch = 0;
  private velocityY = 0;
  private height = 0;
  private shootCooldown = 0;
  private reloadDuration = 0;
  private bob = 0;
  private recoil = 0;
  private slideTime = 0;
  private invulnerable = 0;
  private ultActive = 0;
  private scanActive = 0;
  private ringDamageTime = 0;
  private lastHurt = 0;
  private footTime = 0;
  private lobbyView: ViewId = "play";
  private mouseX = 0;
  private mouseY = 0;
  private touchMove = { x: 0, y: 0 };
  private touchLook: { x: number; y: number; id: number } | null = null;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private frameCount = 0;
  private fpsTime = 0;
  private fallbackLook = false;
  private softwareRenderer = false;
  private onSnapshot: (snapshot: GameSnapshot) => void;
  private onResult: (result: MatchResult) => void;
  private onMap: (show: boolean) => void;
  private onError: (error: string) => void;

  constructor(
    container: HTMLElement,
    settings: Settings,
    onSnapshot: (s: GameSnapshot) => void,
    onResult: (r: MatchResult) => void,
    onMap: (show: boolean) => void,
    onError: (error: string) => void,
  ) {
    this.settings = settings;
    // Read-only diagnostics for reproducible input-driven acceptance checks.
    if(new URLSearchParams(location.search).has('qa')) Object.defineProperty(window,'__originalQa',{configurable:true,get:()=>JSON.parse(JSON.stringify({...this.state, selection:this.options}))});

    this.onSnapshot = onSnapshot;
    this.onResult = onResult;
    this.onMap = onMap;
    this.onError = onError;
    this.audio = new GameAudio(settings);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    this.softwareRenderer =
      !!debug &&
      /swiftshader|llvmpipe|software/i.test(
        gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      );
    setFastMaterials(this.softwareRenderer);
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.softwareRenderer ? 0.85 : settings.quality === "high" ? 1.65 : 1,
      ),
    );
    this.renderer.shadowMap.enabled =
      settings.quality === "high" && !this.softwareRenderer;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-label", "火线1942交互式3D战场");
    this.canvas.setAttribute("tabindex", "-1");
    container.appendChild(this.canvas);
    this.world = createWorld(this.softwareRenderer);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.08, 450);
    const narrow = container.clientWidth < 800;
    this.camera.position.set(3.6, 2.7, narrow ? 39.7 : 38);
    this.camera.lookAt(narrow ? -1.15 : -0.8, 1.9, 31);
    this.hero = createCharacter("tavi");
    optimizeModel(this.hero);
    this.hero.group.position.set(0, 0.32, 31);
    this.hero.group.rotation.y = -0.22;
    this.world.scene.add(this.hero.group);
    this.showcaseWeapon = this.buildWeapon("carbine");
    this.showcaseWeapon.scale.setScalar(3.2);
    this.showcaseWeapon.position.set(0, 2.1, 31);
    this.showcaseWeapon.visible = false;
    this.world.scene.add(this.showcaseWeapon);
    this.weaponModel = this.buildWeapon("carbine", true);
    this.weaponModel.position.set(0.3, -0.27, -0.54);
    this.weaponScene.add(this.weaponModel);
    this.weaponScene.add(new THREE.HemisphereLight("#eef6e2", "#746751", 3));
    const gunLight = new THREE.DirectionalLight("#fff0d2", 3);
    gunLight.position.set(-2, 5, 3);
    this.weaponScene.add(gunLight);
    this.resizeObserver = new ResizeObserver(() => this.resize(container));
    this.resizeObserver.observe(container);
    this.resize(container);
    this.addEvents();
    this.frame = requestAnimationFrame(this.loop);
    if (import.meta.env.DEV)
      (
        window as unknown as { __WINDWARD_DEV__: RelayEngine }
      ).__WINDWARD_DEV__ = this;
  }

  private resize(container: HTMLElement) {
    const w = Math.max(1, container.clientWidth),
      h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.aspect = w / h;
    this.weaponCamera.updateProjectionMatrix();
  }

  private buildWeapon(id: WeaponId, firstPerson = false) {
    const model = createWeapon(id, firstPerson);
    mergeStatic(model);
    return model;
  }

  updateSettings(settings: Settings) {
    this.settings = settings;
    this.audio.update(settings);
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.softwareRenderer ? 0.85 : settings.quality === "high" ? 1.65 : 1,
      ),
    );
    this.renderer.shadowMap.enabled =
      settings.quality === "high" && !this.softwareRenderer;
  }

  setSelection(competitor: LegendId, weapon: WeaponId, skin: string) {
    if (this.state.phase !== "lobby") return;
    if (competitor !== this.options.competitor || skin !== this.options.skin) {
      releaseGeometry(this.hero.group);
      this.hero = createCharacter(competitor, skin);
      optimizeModel(this.hero);
      this.hero.group.position.set(0, 0.32, 31);
      this.hero.group.rotation.y = -0.22;
      this.world.scene.add(this.hero.group);
    }
    if (weapon !== this.options.weapon) {
      releaseGeometry(this.showcaseWeapon);
      this.showcaseWeapon = this.buildWeapon(weapon);
      this.showcaseWeapon.scale.setScalar(3.2);
      this.showcaseWeapon.position.set(0, 2.1, 31);
      this.world.scene.add(this.showcaseWeapon);
      releaseGeometry(this.weaponModel);
      this.weaponModel = this.buildWeapon(weapon, true);
      this.weaponModel.position.set(0.3, -0.27, -0.54);
      this.weaponScene.add(this.weaponModel);
    }
    this.options = { ...this.options, competitor, weapon, skin };
    this.hero.group.visible = this.lobbyView !== "armory";
    this.showcaseWeapon.visible = this.lobbyView === "armory";
  }

  setView(view: ViewId) {
    this.lobbyView = view;
    this.hero.group.visible = view !== "armory";
    this.showcaseWeapon.visible = view === "armory";
  }

  start(options: MatchOptions) {
    this.lastFrame = performance.now();
    this.audio.unlock();
    this.setSelection(options.competitor, options.weapon, options.skin);
    this.options = options;
    const competitor = COMPETITORS.find((l) => l.id === options.competitor)!;
    const weapon = WEAPONS.find((w) => w.id === options.weapon)!;
    this.state = {
      ...INITIAL_SNAPSHOT,
      phase: "countdown",
      maxShield: competitor.shield,
      shield: competitor.shield,
      ammo: weapon.magazine,
      maxAmmo: weapon.magazine,
      feed: [],
      entities: [],
      ultimate: 35,
      remaining: options.mode === "training" ? 5 : 9,
    };
    this.yaw = 0;
    this.pitch = -0.015;
    this.velocityY = 0;
    this.height = 0;
    this.bob = 0;
    this.recoil = 0;
    this.shootCooldown = 0;
    this.reloadDuration = 0;
    this.slideTime = 0;
    this.invulnerable = 0;
    this.ultActive = 0;
    this.scanActive = 0;
    this.lastHurt = 0;
    this.ringDamageTime = 0;
    this.keys.clear();
    this.trigger = false;
    this.rightMouse = false;
    this.touchMove = { x: 0, y: 0 };
    for (const bot of this.bots) releaseGeometry(bot.model.group);
    this.bots = [];
    for (const e of this.effects) this.removeEffect(e);
    this.effects = [];
    this.hero.group.visible = false;
    this.showcaseWeapon.visible = false;
    this.world.pad.visible = false;
    this.world.ring.visible = options.mode === "squads";
    for (const pickup of this.world.pickups) {
      pickup.visible = true;
      pickup.userData.cooldown = 0;
    }
    const spawns =
      options.mode === "training"
        ? [
            [-7, 25],
            [0, 19],
            [8, 24],
            [-11, 4],
            [13, 1],
          ]
        : [
            [-19, 3],
            [-15, -1],
            [-24, -3],
            [20, 3],
            [24, -2],
            [16, -4],
            [-8, -25],
            [9, -27],
            [0, -43],
          ];
    for (let i = 0; i < spawns.length; i++)
      this.spawnBot(i, spawns[i][0], spawns[i][1], false);
    if (options.mode === "squads") {
      this.spawnBot(9, -3, 36, true);
      this.spawnBot(10, 3, 36, true);
    }
    this.camera.fov = 78;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 1.72, 38);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.weaponModel.position.set(0.3, -0.27, -0.54);
    this.weaponModel.rotation.set(0, 0, 0);
    this.publish();
    this.requestLock();
  }

  private spawnBot(index: number, x: number, z: number, ally: boolean) {
    const legendId: LegendId = ally
      ? index === 9
        ? "boren"
        : "nima"
      : (["tavi", "boren", "nima"] as const)[index % 3];
    const model = createCharacter(legendId, "carbon", !ally);
    optimizeModel(model);
    model.group.scale.setScalar(0.62);
    model.group.position.set(x, 0, z);
    this.world.scene.add(model.group);
    const bot: Bot = {
      id: `${ally ? "ally" : "rival"}-${index}`,
      name: ally ? (index === 9 ? "磐石" : "猎鹰") : botNames[index],
      model,
      x,
      z,
      health: ally ? 180 : 115,
      maxHealth: ally ? 180 : 115,
      alive: true,
      ally,
      cooldown: 2 + index * 0.17,
      seed: index * 1.84,
      respawn: 0,
      lastHit: -100,
      speed: ally ? 5.8 : 2.5 + (index % 3) * 0.35,
      targetOffset: index % 2 ? 1 : -1,
    };
    this.bots.push(bot);
  }

  private requestLock() {
    if (matchMedia("(pointer:coarse)").matches) return;
    try {
      const result = this.canvas.requestPointerLock();
      if (result)
        void result.catch(() => {
          this.fallbackLook = true;
        });
    } catch {
      this.fallbackLook = true;
    }
  }

  pause() {
    if (this.state.phase !== "playing" && this.state.phase !== "countdown")
      return;
    this.state.phase = "paused";
    this.state.locked = false;
    this.keys.clear();
    this.trigger = false;
    this.rightMouse = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchLook = null;
    document.exitPointerLock?.();
    this.publish();
  }
  resume() {
    if (this.state.phase !== "paused") return;
    this.audio.unlock();
    this.lastFrame = performance.now();
    this.state.phase = this.state.countdown > 0 ? "countdown" : "playing";
    this.publish();
    this.requestLock();
  }

  returnToLobby() {
    this.state.phase = "lobby";
    document.exitPointerLock?.();
    this.keys.clear();
    this.trigger = false;
    this.rightMouse = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchLook = null;
    for (const bot of this.bots) releaseGeometry(bot.model.group);
    this.bots = [];
    for (const e of this.effects) this.removeEffect(e);
    this.effects = [];
    this.world.ring.visible = false;
    this.world.pad.visible = true;
    this.setView(this.lobbyView);
    const narrow = this.canvas.clientWidth < 800;
    this.camera.position.set(3.6, 2.7, narrow ? 39.7 : 38);
    this.camera.fov = narrow ? 44 : 40;
    this.camera.lookAt(narrow ? -1.15 : -0.8, 1.9, 31);
    this.camera.updateProjectionMatrix();
    this.publish();
  }

  finishTraining() {
    if (
      this.options.mode === "training" &&
      ["playing", "paused"].includes(this.state.phase)
    )
      this.finish("training");
  }

  getSnapshot() {
    return {
      ...this.state,
      entities: this.state.entities.map((e) => ({ ...e })),
    };
  }
  createPortraits(): Record<LegendId, string> {
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(240, 280, false);
    const portraits = {} as Record<LegendId, string>;
    for (const competitor of COMPETITORS) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(
        competitor.id === "tavi"
          ? "#777a63"
          : competitor.id === "boren"
            ? "#735c51"
            : "#526b69",
      );
      const character = createCharacter(competitor.id);
      optimizeModel(character);
      character.group.rotation.y = -0.24;
      scene.add(character.group);
      scene.add(new THREE.HemisphereLight("#f4f4dd", "#384441", 3));
      const light = new THREE.DirectionalLight("#fff0ce", 4);
      light.position.set(-3, 6, 5);
      scene.add(light);
      const camera = new THREE.PerspectiveCamera(32, 240 / 280, 0.1, 20);
      camera.position.set(0.7, 2.75, 2.6);
      camera.lookAt(0, 2.5, 0);
      this.renderer.render(scene, camera);
      portraits[competitor.id] = this.canvas.toDataURL("image/webp", 0.92);
      releaseGeometry(character.group);
    }
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(size.x, size.y, false);
    this.renderer.render(this.world.scene, this.camera);
    return portraits;
  }
  setTouchMove(x: number, y: number) {
    this.touchMove = { x, y };
  }
  setTouchFire(firing: boolean) {
    this.audio.unlock();
    this.trigger = firing;
  }
  action(
    action:
      "reload" | "tactical" | "ultimate" | "heal" | "grenade" | "jump" | "map",
  ) {
    if (this.state.phase !== "playing") return;
    if (action === "reload") this.reload();
    if (action === "tactical") this.tactical();
    if (action === "ultimate") this.ultimate();
    if (action === "heal") this.heal();
    if (action === "grenade") this.grenade();
    if (action === "jump") this.jump();
    if (action === "map") this.onMap(true);
  }

  private addEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", this.onLockError);
    this.canvas.addEventListener("contextmenu", this.onContext);
    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd);
    this.canvas.addEventListener("touchcancel", this.onTouchEnd);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
  }
  private onKeyDown = (event: KeyboardEvent) => {
    if (document.querySelector('[role="dialog"]:not([data-game-pause])'))
      return;
    if (this.state.phase === "lobby" || this.state.phase === "ended") return;
    if (event.code === "Escape" || event.code === "KeyP") {
      if (!event.repeat) {
        if (this.state.phase === "paused") this.resume();
        else this.pause();
      }
      return;
    }
    if (this.state.phase === "paused") return;
    if (
      [
        "Tab",
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(event.code)
    )
      event.preventDefault();
    if (this.state.phase !== "playing") return;
    this.keys.add(event.code);
    if (event.repeat) return;
    const actions: Record<string, Parameters<RelayEngine["action"]>[0]> = {
      KeyR: "reload",
      KeyQ: "tactical",
      KeyZ: "ultimate",
      KeyE: "heal",
      KeyG: "grenade",
      Space: "jump",
    };
    if (actions[event.code]) this.action(actions[event.code]);
    if (event.code === "KeyC" && this.state.sprinting && this.height < 0.1)
      this.slideTime = 0.8;
    if (event.code === "Tab" || event.code === "KeyM") this.onMap(true);
  };
  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === "Tab" || event.code === "KeyM") this.onMap(false);
  };
  private onMouseMove = (event: MouseEvent) => {
    if (this.state.phase === "lobby") {
      this.mouseX = event.clientX / innerWidth - 0.5;
      this.mouseY = event.clientY / innerHeight - 0.5;
      return;
    }
    if (this.state.phase !== "playing" && this.state.phase !== "countdown")
      return;
    if (document.pointerLockElement !== this.canvas && !this.fallbackLook)
      return;
    const sensitivity =
      this.settings.sensitivity * 0.000047 * (this.rightMouse ? 0.55 : 1);
    this.yaw -= event.movementX * sensitivity;
    this.pitch = clamp(
      this.pitch -
        event.movementY * sensitivity * (this.settings.invertY ? -1 : 1),
      -1.28,
      1.28,
    );
  };
  private onMouseDown = (event: MouseEvent) => {
    if (event.target !== this.canvas) return;
    if (this.state.phase !== "playing") return;
    this.audio.unlock();
    if (
      document.pointerLockElement !== this.canvas &&
      !matchMedia("(pointer:coarse)").matches
    )
      this.requestLock();
    if (event.button === 0) this.trigger = true;
    if (event.button === 2) this.rightMouse = true;
  };
  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.trigger = false;
    if (event.button === 2) this.rightMouse = false;
  };
  private onBlur = () => this.pause();
  private onVisibility = () => {
    if (document.hidden) this.pause();
  };
  private onLockChange = () => {
    const wasLocked = this.state.locked;
    this.state.locked = document.pointerLockElement === this.canvas;
    if (this.state.locked) this.fallbackLook = false;
    if (
      wasLocked &&
      !this.state.locked &&
      this.state.phase === "playing" &&
      !this.fallbackLook
    )
      this.pause();
  };
  private onLockError = () => {
    this.fallbackLook = true;
  };
  private onContext = (e: Event) => e.preventDefault();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.onError(
      "The 3D renderer was interrupted. Reload the arena to reconnect.",
    );
  };
  private onTouchStart = (e: TouchEvent) => {
    if (this.state.phase !== "playing") return;
    e.preventDefault();
    const t = e.changedTouches[0];
    this.touchLook = { x: t.clientX, y: t.clientY, id: t.identifier };
  };
  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchLook || this.state.phase !== "playing") return;
    e.preventDefault();
    const t = Array.from(e.changedTouches).find(
      (t) => t.identifier === this.touchLook!.id,
    );
    if (!t) return;
    const sensitivity = this.settings.sensitivity * 0.000065;
    this.yaw -= (t.clientX - this.touchLook.x) * sensitivity;
    this.pitch = clamp(
      this.pitch -
        (t.clientY - this.touchLook.y) *
          sensitivity *
          (this.settings.invertY ? -1 : 1),
      -1.28,
      1.28,
    );
    this.touchLook.x = t.clientX;
    this.touchLook.y = t.clientY;
  };
  private onTouchEnd = (e: TouchEvent) => {
    if (
      this.touchLook &&
      Array.from(e.changedTouches).some(
        (t) => t.identifier === this.touchLook!.id,
      )
    )
      this.touchLook = null;
  };

  private loop = (timestamp: number) => {
    if (this.disposed) return;
    const rawDelta = this.lastFrame ? Math.max(0, (timestamp - this.lastFrame) / 1000) : 1 / 60;
    const elapsedDelta = Math.min(rawDelta, 1);
    const dt = Math.min(elapsedDelta, 0.05);
    this.lastFrame = timestamp;
    this.elapsed += elapsedDelta;
    this.publishElapsed += elapsedDelta;
    this.frameCount++;
    this.fpsTime += rawDelta;
    if (this.fpsTime > 1) {
      this.state.fps = Math.round(this.frameCount / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
    }
    if (this.state.phase === "lobby") this.updateLobby(dt);
    let simulationDelta = elapsedDelta;
    if (this.state.phase === "countdown") {
      const previous = Math.ceil(this.state.countdown);
      simulationDelta = Math.max(0, elapsedDelta - this.state.countdown);
      this.state.countdown = Math.max(0, this.state.countdown - elapsedDelta);
      if (Math.ceil(this.state.countdown) !== previous)
        this.audio.play("start");
      if (this.state.countdown === 0) {
        this.state.phase = "playing";
        this.message(
          this.options.mode === "training"
            ? "靶场开放 · 尽情练习"
            : "消灭所有敌方小队",
        );
        this.feed(
          this.options.mode === "training"
            ? "靶场 · 5 个靶标已启用"
            : "磐石 + 猎鹰 加入了你的小队",
          true,
        );
      }
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    if (this.state.phase === "playing" && simulationDelta > 0) {
      const steps = Math.ceil(simulationDelta * 60);
      const stepDelta = simulationDelta / steps;
      for (let step = 0; step < steps && this.state.phase === "playing"; step++)
        this.updateGame(stepDelta);
    }
    this.world.dust.rotation.y = this.elapsed * 0.004;
    if (this.state.phase !== "paused") this.updateEffects(dt);
    this.renderer.autoClear = true;
    this.renderer.render(this.world.scene, this.camera);
    if (["playing", "countdown", "paused"].includes(this.state.phase)) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, this.weaponCamera);
    }
    if (this.publishElapsed > 0.075) {
      this.publishElapsed = 0;
      this.publish();
    }
    this.frame = requestAnimationFrame(this.loop);
  };

  private updateLobby(dt: number) {
    const w = this.canvas.clientWidth;
    const narrow = w < 800;
    const aspect = this.camera.aspect;
    const target = new THREE.Vector3(narrow ? -1.15 : -0.8, 1.9, 31);
    const distance = narrow ? 8.7 : 7.0;
    const desired = new THREE.Vector3(
      3.6 + this.mouseX * 0.25,
      2.7 - this.mouseY * 0.13,
      31 + distance,
    );
    if (aspect > 2.1) desired.z = 38;
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      narrow ? 44 : 40,
      1 - Math.exp(-dt * 5),
    );
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
    animateCharacter(this.hero, this.elapsed);
    this.hero.group.rotation.y =
      -0.23 + Math.sin(this.elapsed * 0.23) * 0.07 + this.mouseX * 0.075;
    this.showcaseWeapon.rotation.set(
      -0.12,
      Math.sin(this.elapsed * 0.24) * 0.2 + 1.12,
      -0.28,
    );
    this.showcaseWeapon.position.y =
      2.05 + Math.sin(this.elapsed * 0.9) * 0.045;
  }

  private updateGame(dt: number) {
    const s = this.state;
    const competitor = COMPETITORS.find((l) => l.id === this.options.competitor)!;
    s.time += dt;
    s.hit = Math.max(0, s.hit - dt);
    s.damageFlash = Math.max(0, s.damageFlash - dt);
    s.messageTime = Math.max(0, s.messageTime - dt);
    s.abilityCooldown = Math.max(0, s.abilityCooldown - dt);
    s.healCooldown = Math.max(0, s.healCooldown - dt);
    s.grenadeCooldown = Math.max(0, s.grenadeCooldown - dt);
    s.activeAbility = Math.max(0, s.activeAbility - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.ultActive = Math.max(0, this.ultActive - dt);
    this.scanActive = Math.max(0, this.scanActive - dt);
    this.slideTime = Math.max(0, this.slideTime - dt);
    s.ultimate = Math.min(
      100,
      s.ultimate + dt * (this.options.mode === "training" ? 4 : 1.6),
    );
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (s.reloading > 0) {
      s.reloading = Math.max(0, s.reloading - dt);
      if (s.reloading === 0) {
        s.ammo = s.maxAmmo;
        this.audio.play("reload");
      }
    }
    let moveX =
      (this.keys.has("KeyD") ? 1 : 0) -
      (this.keys.has("KeyA") ? 1 : 0) +
      this.touchMove.x;
    let moveZ =
      (this.keys.has("KeyS") ? 1 : 0) -
      (this.keys.has("KeyW") ? 1 : 0) +
      this.touchMove.y;
    if (this.keys.has("ArrowLeft")) this.yaw += dt * 1.7;
    if (this.keys.has("ArrowRight")) this.yaw -= dt * 1.7;
    if (this.keys.has("ArrowUp"))
      this.pitch = clamp(this.pitch + dt * 0.8, -1.28, 1.28);
    if (this.keys.has("ArrowDown"))
      this.pitch = clamp(this.pitch - dt * 0.8, -1.28, 1.28);
    const moveLength = Math.hypot(moveX, moveZ);
    if (moveLength > 1) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }
    s.aiming = this.rightMouse;
    s.sprinting =
      (this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        Math.hypot(this.touchMove.x, this.touchMove.y) > 0.93) &&
      moveLength > 0.1 &&
      !this.rightMouse;
    let speed =
      competitor.speed *
      (s.sprinting ? 1.48 : 1) *
      (this.rightMouse ? 0.58 : 1) *
      (this.ultActive > 0 && this.options.competitor === "tavi" ? 1.38 : 1) *
      (this.slideTime > 0 ? 1.65 : 1);
    if (this.invulnerable > 0.2 && this.options.competitor === "tavi")
      speed *= 2.2;
    if (this.slideTime > 0 && moveLength < 0.1) moveZ = -1;
    const dx =
      (moveX * Math.cos(this.yaw) + moveZ * Math.sin(this.yaw)) * speed * dt;
    const dz =
      (-moveX * Math.sin(this.yaw) + moveZ * Math.cos(this.yaw)) * speed * dt;
    const next = resolveMovement(s.x, s.z, dx, dz, this.world.obstacles);
    s.x = next.x;
    s.z = next.z;
    if (moveLength > 0.1) {
      this.bob += dt * (s.sprinting ? 14 : 10);
      this.footTime += dt;
      if (this.footTime > (s.sprinting ? 0.28 : 0.43) && this.height < 0.1) {
        this.audio.play("step");
        this.footTime = 0;
      }
    }
    this.velocityY -= 20 * dt;
    this.height = Math.max(0, this.height + this.velocityY * dt);
    if (this.height === 0) this.velocityY = 0;
    this.camera.position.set(
      s.x,
      1.72 +
        this.height +
        (moveLength > 0.1 ? Math.sin(this.bob) * 0.035 : 0) -
        (this.slideTime > 0 ? 0.62 : 0),
      s.z,
    );
    this.camera.rotation.set(
      this.pitch + this.recoil * 0.009,
      this.yaw,
      Math.sin(this.bob * 0.5) * 0.004 * (moveLength > 0.1 ? 1 : 0),
      "YXZ",
    );
    const targetFov = this.rightMouse
      ? this.options.weapon === "longshot"
        ? 43
        : 59
      : s.sprinting
        ? 86
        : 78;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      1 - Math.exp(-dt * 11),
    );
    this.camera.updateProjectionMatrix();
    if (this.trigger) this.shoot();
    const aim = this.rightMouse ? 1 : 0;
    const reloadProgress =
      s.reloading > 0
        ? Math.sin((1 - s.reloading / this.reloadDuration) * Math.PI)
        : 0;
    this.weaponModel.position.set(
      THREE.MathUtils.lerp(0.3, 0, aim) +
        Math.sin(this.bob) * 0.008 * (moveLength > 0.1 ? 1 : 0),
      THREE.MathUtils.lerp(-0.27, -0.25, aim) - reloadProgress * 0.3,
      -0.54 + this.recoil * 0.09,
    );
    this.weaponModel.rotation.set(
      this.recoil * 0.12 + reloadProgress * 0.5 + (s.sprinting ? 0.18 : 0),
      reloadProgress * -0.7,
      -reloadProgress * 0.55 + (s.sprinting ? -0.14 : 0),
    );
    s.yaw = this.yaw;
    s.ringRadius = this.options.mode === "training" ? 67 : ringAt(s.time);
    s.outOfRing = Math.hypot(s.x, s.z) > s.ringRadius;
    this.world.ring.scale.set(s.ringRadius, 1, s.ringRadius);
    (this.world.ring.material as THREE.ShaderMaterial).uniforms.time.value =
      this.elapsed;
    if (s.outOfRing && this.options.mode === "squads") {
      this.ringDamageTime += dt;
      if (this.ringDamageTime > 1) {
        this.hurt(7);
        this.ringDamageTime = 0;
      }
    } else this.ringDamageTime = 0;
    if (s.time - this.lastHurt > 8 && s.shield < s.maxShield)
      s.shield = Math.min(s.maxShield, s.shield + dt * 6);
    this.updateBots(dt);
    for (const pickup of this.world.pickups) {
      pickup.userData.cooldown = Math.max(
        0,
        (pickup.userData.cooldown || 0) - dt,
      );
      pickup.visible = pickup.userData.cooldown === 0;
      if (pickup.visible) {
        pickup.rotation.y += dt * 0.5;
        if (
          Math.hypot(s.x - pickup.position.x, s.z - pickup.position.z) < 1.9 &&
          (s.health < 100 || s.shield < s.maxShield)
        ) {
          s.health = Math.min(100, s.health + 35);
          s.shield = Math.min(s.maxShield, s.shield + 35);
          pickup.userData.cooldown = 22;
          pickup.visible = false;
          this.audio.play("shield");
          this.message("已拾取补给 · +35 生命与护甲");
        }
      }
    }
    if (this.options.mode === "squads") {
      if (s.remaining === 0) this.finish("champion");
      else if (s.time >= 180) this.finish("timeout");
    }
  }

  private updateBots(dt: number) {
    const s = this.state;
    for (const bot of this.bots) {
      if (!bot.alive) {
        if (this.options.mode === "training") {
          bot.respawn -= dt;
          if (bot.respawn <= 0) {
            bot.alive = true;
            bot.health = bot.maxHealth;
            bot.model.group.visible = true;
            s.remaining++;
          }
        }
        continue;
      }
      bot.cooldown -= dt;
      let tx = s.x,
        tz = s.z;
      let targetBot: Bot | undefined;
      if (bot.ally) {
        targetBot = this.bots
          .filter((b) => !b.ally && b.alive)
          .sort(
            (a, b) =>
              Math.hypot(a.x - bot.x, a.z - bot.z) -
              Math.hypot(b.x - bot.x, b.z - bot.z),
          )[0];
        const followDist = Math.hypot(s.x - bot.x, s.z - bot.z);
        if (followDist > 8 || !targetBot) {
          tx = s.x + (bot.seed > 17 ? 3 : -3);
          tz = s.z + 2;
        } else {
          tx = targetBot.x;
          tz = targetBot.z;
        }
      } else if (this.options.mode === "squads") {
        const ally = this.bots.find(
          (b) =>
            b.ally &&
            b.alive &&
            Math.hypot(b.x - bot.x, b.z - bot.z) <
              Math.hypot(s.x - bot.x, s.z - bot.z) * 0.8,
        );
        if (ally) {
          targetBot = ally;
          tx = ally.x;
          tz = ally.z;
        }
      }
      const distance = Math.hypot(tx - bot.x, tz - bot.z);
      let walking = 0;
      if (this.options.mode !== "training") {
        let dirX = (tx - bot.x) / (distance || 1),
          dirZ = (tz - bot.z) / (distance || 1);
        let speed = bot.speed;
        if (distance < (bot.ally ? 7 : 15)) {
          const oldX = dirX;
          dirX = -dirZ * bot.targetOffset;
          dirZ = oldX * bot.targetOffset;
          speed *= 0.5;
        }
        if (Math.hypot(bot.x, bot.z) > s.ringRadius - 4) {
          const d = Math.hypot(bot.x, bot.z);
          dirX = -bot.x / d;
          dirZ = -bot.z / d;
          speed *= 1.8;
        }
        const oldX = bot.x,
          oldZ = bot.z;
        const next = resolveMovement(
          bot.x,
          bot.z,
          dirX * speed * dt,
          dirZ * speed * dt,
          this.world.obstacles,
          0.45,
        );
        bot.x = next.x;
        bot.z = next.z;
        if (Math.hypot(bot.x - oldX, bot.z - oldZ) < dt * 0.1) {
          const around = resolveMovement(
            bot.x,
            bot.z,
            -dirZ * speed * dt * bot.targetOffset,
            dirX * speed * dt * bot.targetOffset,
            this.world.obstacles,
            0.45,
          );
          bot.x = around.x;
          bot.z = around.z;
          if (Math.sin(s.time + bot.seed) > 0.99) bot.targetOffset *= -1;
        }
        walking = Math.hypot(bot.x - oldX, bot.z - oldZ) > dt * 0.1 ? 1 : 0;
      }
      bot.model.group.position.set(bot.x, 0, bot.z);
      bot.model.group.rotation.y = Math.atan2(tx - bot.x, tz - bot.z);
      animateCharacter(bot.model, this.elapsed + bot.seed, walking);
      if (this.options.mode === "training") continue;
      if (bot.cooldown <= 0 && distance < 50 && s.time > 4) {
        bot.cooldown = bot.ally
          ? 0.64 + Math.random() * 0.42
          : 0.95 + Math.random() * 0.95;
        const target = new THREE.Vector3(
          tx,
          targetBot ? 1.1 : 1.25 + this.height,
          tz,
        );
        const origin = new THREE.Vector3(bot.x, 1.28, bot.z);
        const direction = target.clone().sub(origin).normalize();
        ray.set(origin, direction);
        ray.far = distance;
        const obstructed = ray
          .intersectObjects(this.world.colliders, false)
          .some((hit) => hit.distance < distance - 0.6);
        if (!obstructed) {
          this.tracer(origin, target, bot.ally ? "#d7efaa" : "#efb480");
          const accuracy = bot.ally
            ? 0.8
            : clamp(0.68 - distance * 0.007, 0.23, 0.68);
          if (Math.random() < accuracy) {
            if (targetBot) {
              this.damageBot(targetBot, bot.ally ? 13 : 7, false);
            } else this.hurt(6 + Math.random() * 4);
          }
        }
      }
      if (Math.hypot(bot.x, bot.z) > s.ringRadius + 2) {
        bot.health -= dt * 6;
        if (bot.health <= 0) this.damageBot(bot, 1, false);
      }
    }
  }

  private shoot() {
    const s = this.state;
    if (s.phase !== "playing" || this.shootCooldown > 0 || s.reloading > 0)
      return;
    if (s.ammo === 0) {
      this.reload();
      return;
    }
    const weapon = WEAPONS.find((w) => w.id === this.options.weapon)!;
    this.shootCooldown = weapon.interval;
    if (!(this.ultActive > 0 && this.options.competitor === "tavi")) s.ammo--;
    this.recoil = 1;
    this.audio.play(weapon.id === "carbine" ? "shot" : "heavy");
    const origin = this.camera.position.clone();
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const muzzle = origin.clone().add(direction.clone().multiplyScalar(0.8));
    muzzle.add(
      new THREE.Vector3(0.24, -0.17, 0).applyQuaternion(this.camera.quaternion),
    );
    this.burst(muzzle, "#ffe8a2", 3, 0.16, 0.065);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      this.camera.quaternion,
    );
    const up = UP.clone().applyQuaternion(this.camera.quaternion);
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const spread = weapon.spread * (this.rightMouse ? 0.3 : 1);
      const dir = direction
        .clone()
        .addScaledVector(right, (Math.random() - 0.5) * spread)
        .addScaledVector(up, (Math.random() - 0.5) * spread)
        .normalize();
      ray.set(origin, dir);
      ray.far = weapon.range;
      const wall = ray.intersectObjects(this.world.colliders, false)[0];
      let maxDist = wall ? wall.distance : weapon.range;
      let victim: Bot | undefined;
      let headshot = false;
      for (const bot of this.bots) {
        if (!bot.alive || bot.ally) continue;
        const body = new THREE.Box3(
          new THREE.Vector3(bot.x - 0.42, 0.25, bot.z - 0.35),
          new THREE.Vector3(bot.x + 0.42, 1.95, bot.z + 0.35),
        );
        const hit = ray.ray.intersectBox(body, new THREE.Vector3());
        if (hit) {
          const dist = origin.distanceTo(hit);
          if (dist < maxDist) {
            maxDist = dist;
            victim = bot;
            headshot = hit.y > 1.63;
          }
        }
      }
      const end = origin.clone().addScaledVector(dir, maxDist);
      this.tracer(muzzle, end, "#fff0be");
      if (victim) {
        const falloff =
          weapon.id === "breacher"
            ? clamp(1 - maxDist / 48, 0.28, 1)
            : clamp(1 - maxDist / 160, 0.65, 1);
        const damage = Math.round(
          weapon.damage * falloff * (headshot ? 1.65 : 1),
        );
        this.damageBot(victim, damage, true);
        this.burst(end, headshot ? "#ffe29c" : "#dcf2bb", 4, 0.23, 0.12);
      } else if (wall) this.burst(end, "#d8c2a0", 3, 0.22, 0.08);
    }
  }

  private reload() {
    if (this.state.reloading > 0 || this.state.ammo === this.state.maxAmmo)
      return;
    this.reloadDuration = WEAPONS.find(
      (w) => w.id === this.options.weapon,
    )!.reload;
    this.state.reloading = this.reloadDuration;
    this.audio.play("reload");
  }
  private jump() {
    if (this.height < 0.01) {
      this.velocityY = 7.8;
      this.slideTime = 0;
      this.audio.play("jump");
    }
  }

  private tactical() {
    const s = this.state;
    if (s.abilityCooldown > 0) {
      this.message(
        `战术技能冷却中 · ${Math.ceil(s.abilityCooldown)} 秒`,
        1.5,
      );
      return;
    }
    const competitor = COMPETITORS.find((l) => l.id === this.options.competitor)!;
    s.abilityCooldown = competitor.cooldown;
    this.audio.play("ability");
    this.message(competitor.ability + " 已发动");
    if (competitor.id === "tavi") {
      this.invulnerable = 1.2;
      s.activeAbility = 1.2;
      let x =
          (this.keys.has("KeyD") ? 1 : 0) -
          (this.keys.has("KeyA") ? 1 : 0) +
          this.touchMove.x,
        z =
          (this.keys.has("KeyS") ? 1 : 0) -
          (this.keys.has("KeyW") ? 1 : 0) +
          this.touchMove.y;
      if (Math.hypot(x, z) < 0.1) z = -1;
      const len = Math.hypot(x, z);
      x /= len;
      z /= len;
      for (let i = 0; i < 15; i++) {
        const next = resolveMovement(
          s.x,
          s.z,
          (x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) * 0.5,
          (-x * Math.sin(this.yaw) + z * Math.cos(this.yaw)) * 0.5,
          this.world.obstacles,
        );
        s.x = next.x;
        s.z = next.z;
      }
      this.shockwave(new THREE.Vector3(s.x, 1, s.z), "#d9eea0", 3);
    } else if (competitor.id === "boren") {
      s.shield = Math.min(s.maxShield, s.shield + 45);
      s.activeAbility = 5;
      this.shockwave(new THREE.Vector3(s.x, 1, s.z), "#d3dfbe", 4);
    } else {
      this.scanActive = 8;
      s.activeAbility = 8;
      this.shockwave(new THREE.Vector3(s.x, 0.3, s.z), "#b8ddd0", 32);
      for (const bot of this.bots)
        if (!bot.ally && bot.alive && Math.hypot(bot.x - s.x, bot.z - s.z) < 20)
          this.damageBot(bot, 18, true);
    }
  }
  private ultimate() {
    const s = this.state;
    if (s.ultimate < 100) {
      this.message(`终极技能充能中 · ${Math.floor(s.ultimate)}%`, 1.6);
      return;
    }
    s.ultimate = 0;
    this.ultActive = 10;
    this.audio.play("ability");
    this.message(
      COMPETITORS.find((l) => l.id === this.options.competitor)!.ultimate +
        " 已发动",
      3,
    );
    if (this.options.competitor === "tavi") {
      s.ammo = s.maxAmmo;
      s.reloading = 0;
      this.shockwave(new THREE.Vector3(s.x, 0.3, s.z), "#d8ec9f", 8);
    }
    if (this.options.competitor === "boren") {
      s.health = 100;
      s.shield = s.maxShield;
      s.activeAbility = 10;
      for (const bot of this.bots)
        if (bot.ally && bot.alive) bot.health = bot.maxHealth;
      this.shockwave(new THREE.Vector3(s.x, 0.3, s.z), "#d8ec9f", 18);
    }
    if (this.options.competitor === "nima") {
      this.shockwave(new THREE.Vector3(s.x, 0.3, s.z), "#b7dfcf", 32);
      this.scanActive = 10;
      for (const bot of this.bots)
        if (!bot.ally && bot.alive && Math.hypot(bot.x - s.x, bot.z - s.z) < 32)
          this.damageBot(bot, 70, true);
    }
  }
  private heal() {
    const s = this.state;
    if (s.healCooldown > 0) {
      this.message(
        `医疗包冷却中 · ${Math.ceil(s.healCooldown)} 秒`,
        1.5,
      );
      return;
    }
    if (s.shield === s.maxShield && s.health === 100) {
      this.message("生命与护甲均已满", 1.5);
      return;
    }
    s.shield = Math.min(s.maxShield, s.shield + 45);
    s.health = Math.min(100, s.health + 20);
    s.healCooldown = 18;
    this.audio.play("shield");
    this.message("医疗包 · +45 护甲 / +20 生命");
  }
  private grenade() {
    const s = this.state;
    if (s.grenadeCooldown > 0) {
      this.message(
        `手榴弹冷却中 · ${Math.ceil(s.grenadeCooldown)} 秒`,
        1.5,
      );
      return;
    }
    s.grenadeCooldown = 14;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const target = this.camera.position.clone().addScaledVector(dir, 17);
    target.y = 0.6;
    this.shockwave(target, "#e7ca83", 8);
    this.burst(target, "#f3d5a1", 18, 0.8, 0.32);
    this.audio.play("grenade");
    for (const bot of this.bots)
      if (!bot.ally && bot.alive) {
        const dist = Math.hypot(bot.x - target.x, bot.z - target.z);
        if (dist < 8)
          this.damageBot(bot, Math.round(75 * (1 - dist / 11)), true);
      }
    this.message("手榴弹已投出");
  }

  private damageBot(bot: Bot, damage: number, player: boolean) {
    if (!bot.alive) return;
    const amount = Math.min(Math.max(0, bot.health), damage);
    bot.health -= damage;
    if (player) {
      this.state.damage += Math.round(amount);
      this.state.hit = 0.15;
      this.state.lastDamage = Math.round(amount);
      if (this.ultActive <= 0)
        this.state.ultimate = Math.min(100, this.state.ultimate + amount * 0.11);
      bot.lastHit = this.state.time;
      this.audio.play("hit");
    }
    if (bot.health <= 0) {
      bot.alive = false;
      bot.health = 0;
      bot.model.group.visible = false;
      bot.respawn = 4;
      this.burst(
        new THREE.Vector3(bot.x, 1, bot.z),
        bot.ally ? "#afc9b4" : "#cf946e",
        10,
        0.7,
        0.18,
      );
      if (!bot.ally) {
        this.state.remaining--;
        if (player) {
          this.state.kills++;
          this.audio.play("kill");
          this.message(`已击毙 ${bot.name}`, 2);
          this.feed(`你  →  ${bot.name}`, true);
        } else {
          if (this.state.time - bot.lastHit < 10) this.state.assists++;
          this.feed(`小队  →  ${bot.name}`, true);
        }
      } else this.feed(`${bot.name} 已被击毙`, false);
    }
  }

  private hurt(damage: number) {
    if (this.invulnerable > 0 || this.state.phase !== "playing") return;
    if (this.options.competitor === "boren" && this.state.activeAbility > 0)
      damage *= 0.35;
    const result = applyDamage(this.state.health, this.state.shield, damage);
    this.state.health = result.health;
    this.state.shield = result.shield;
    this.state.damageFlash = 0.38;
    this.lastHurt = this.state.time;
    this.audio.play("hurt");
    if (this.state.health <= 0) {
      if (this.options.mode === "training") {
        this.state.health = 100;
        this.state.shield = this.state.maxShield;
      } else this.finish("eliminated");
    }
  }

  private finish(reason: FinishReason) {
    if (this.state.phase === "ended" || this.state.phase === "lobby") return;
    this.state.phase = "ended";
    this.trigger = false;
    this.rightMouse = false;
    this.keys.clear();
    this.touchMove = { x: 0, y: 0 };
    document.exitPointerLock?.();
    this.onMap(false);
    const won = reason === "champion";
    const reward =
      this.options.mode === "training"
        ? { xp: 0, credits: 0 }
        : rewards(this.state.kills, this.state.damage, won);
    if (won) this.audio.play("win");
    const result: MatchResult = {
      reason,
      kills: this.state.kills,
      assists: this.state.assists,
      damage: this.state.damage,
      duration: this.state.time,
      placement: won ? 1 : Math.min(4, 1 + Math.ceil(this.state.remaining / 3)),
      mode: this.options.mode,
      ...reward,
    };
    this.publish();
    this.onResult(result);
  }

  private message(text: string, duration = 2.5) {
    this.state.message = text;
    this.state.messageTime = duration;
  }
  private feed(text: string, ally: boolean) {
    this.state.feed = [
      { id: performance.now(), text, time: this.state.time, ally },
      ...this.state.feed,
    ].slice(0, 4);
  }

  private tracer(start: THREE.Vector3, end: THREE.Vector3, color: string) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mesh = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.world.scene.add(mesh);
    this.effects.push({ mesh, life: 0.085, maxLife: 0.085, type: "tracer" });
  }
  private burst(
    position: THREE.Vector3,
    color: string,
    count: number,
    life: number,
    size: number,
  ) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.position.copy(position);
      this.world.scene.add(mesh);
      this.effects.push({
        mesh,
        life,
        maxLife: life,
        type: "burst",
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      });
    }
  }
  private shockwave(position: THREE.Vector3, color: string, radius: number) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.025, 4, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(position);
    mesh.userData.radius = radius;
    this.world.scene.add(mesh);
    this.effects.push({ mesh, life: 0.8, maxLife: 0.8, type: "ring" });
  }
  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.removeEffect(e);
        this.effects.splice(i, 1);
        continue;
      }
      const material = (e.mesh as THREE.Mesh).material as THREE.Material & {
        opacity: number;
      };
      material.opacity = e.life / e.maxLife;
      if (e.velocity) {
        e.mesh.position.addScaledVector(e.velocity, dt);
        e.velocity.y -= dt * 5;
      }
      if (e.type === "ring")
        e.mesh.scale.setScalar(
          1 + (1 - e.life / e.maxLife) * e.mesh.userData.radius,
        );
    }
  }
  private removeEffect(effect: Effect) {
    effect.mesh.removeFromParent();
    (effect.mesh as THREE.Mesh).geometry.dispose();
    ((effect.mesh as THREE.Mesh).material as THREE.Material).dispose();
  }

  private publish() {
    this.state.entities = this.bots.map((bot) => {
      vec.set(bot.x, 2.25, bot.z).project(this.camera);
      const distance = Math.hypot(bot.x - this.state.x, bot.z - this.state.z);
      const visible =
        bot.alive &&
        vec.z < 1 &&
        (bot.ally || this.scanActive > 0 || distance < 32);
      return {
        id: bot.id,
        name: bot.name,
        x: bot.x,
        z: bot.z,
        health: bot.health,
        maxHealth: bot.maxHealth,
        ally: bot.ally,
        alive: bot.alive,
        ...(visible
          ? {
              screenX: ((vec.x + 1) / 2) * 100,
              screenY: ((1 - vec.y) / 2) * 100,
            }
          : {}),
      };
    });
    this.onSnapshot({ ...this.state, feed: [...this.state.feed] });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    document.exitPointerLock?.();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    this.canvas.removeEventListener("contextmenu", this.onContext);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.world.scene.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Points ||
        o instanceof THREE.Line
      ) {
        o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if ("map" in m) (m.map as THREE.Texture | null)?.dispose();
          m.dispose();
        }
      }
    });
    this.weaponScene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.renderer.dispose();
    this.audio.dispose();
    this.canvas.remove();
  }
}
