import { addOriginalScenery } from './original-scenery';
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, cylinder, mat } from "./models";
import type { Obstacle } from "./types";

function random(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d")!);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function mergeStatic(parent: THREE.Group) {
  parent.updateMatrixWorld(true);
  const bins = new Map<
    THREE.Material,
    { geometry: THREE.BufferGeometry[]; shadow: boolean }
  >();
  const toRemove: THREE.Mesh[] = [];
  const inverse = parent.matrixWorld.clone().invert();
  parent.traverse((o) => {
    if (
      !(o instanceof THREE.Mesh) ||
      Array.isArray(o.material) ||
      o.userData.dynamic
    )
      return;
    const material = o.material;
    const geometry = o.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if (geometry.index) {
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      add(flat);
    } else add(geometry);
    function add(geo: THREE.BufferGeometry) {
      geo.deleteAttribute("uv");
      geo.deleteAttribute("uv1");
      if (!bins.has(material))
        bins.set(material, { geometry: [], shadow: o.castShadow });
      bins.get(material)!.geometry.push(geo);
    }
    toRemove.push(o);
  });
  for (const mesh of toRemove) mesh.removeFromParent();
  for (const [material, batch] of bins) {
    const merged = mergeGeometries(batch.geometry);
    for (const geo of batch.geometry) geo.dispose();
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = batch.shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}

export interface World {
  scene: THREE.Scene;
  obstacles: Obstacle[];
  colliders: THREE.Mesh[];
  ring: THREE.Mesh;
  dust: THREE.Points;
  pickups: THREE.Group[];
  pad: THREE.Group;
  sun: THREE.DirectionalLight;
}

export function createWorld(lowDetail = false): World {
  const rng = random(7331);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c3c9bc");
  scene.fog = new THREE.FogExp2("#b3b7a6", 0.0078);
  const hemi = new THREE.HemisphereLight("#dde3d2", "#57503e", 1.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffedc8", 3.2);
  sun.position.set(-35, 62, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -64;
  sun.shadow.camera.right = 64;
  sun.shadow.camera.top = 64;
  sun.shadow.camera.bottom = -64;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.07;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight("#cadbd6", 1.1);
  fill.position.set(25, 16, -35);
  scene.add(fill);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(390, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color("#6e7f92") },
        horizon: { value: new THREE.Color("#d8d4c2") },
      },
      vertexShader:
        "varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader:
        "varying vec3 vPosition; uniform vec3 top; uniform vec3 horizon; void main(){float h=pow(max(normalize(vPosition).y,0.0),0.52); vec3 c=mix(horizon,top,h); gl_FragColor=vec4(c,1.0);}",
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  scene.add(sky);

  const groundSegments = lowDetail ? 40 : 120;
  const groundGeometry = new THREE.PlaneGeometry(750, 750, groundSegments, groundSegments);
  groundGeometry.rotateX(-Math.PI / 2);
  const pos = groundGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const dist = Math.hypot(x, z);
    const h =
      dist < (lowDetail ? 96 : 76)
        ? -0.06
        : Math.sin(x * 0.023) * Math.cos(z * 0.027) * 4 +
          Math.sin(x * 0.074 + z * 0.04) * 1.2;
    pos.setY(i, h - 0.08);
  }
  groundGeometry.computeVertexNormals();
  const sand = mat("#877c5d", 1, 0).clone();
  sand.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 vGroundPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGroundPosition = position;",
    );
    shader.fragmentShader =
      "varying vec3 vGroundPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float grain=fract(sin(dot(vGroundPosition.xz,vec2(127.1,311.7)))*43758.5453);
      float dune=sin(vGroundPosition.x*0.34+sin(vGroundPosition.z*0.21)*1.8)*0.025;
      float track=smoothstep(0.13,0.17,abs(sin(vGroundPosition.x*0.18+0.25)))*0.025;
      diffuseColor.rgb *= 0.92+grain*0.11+dune+track;`,
    );
  };
  const ground = new THREE.Mesh(groundGeometry, sand);
  ground.receiveShadow = true;
  scene.add(ground);
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const obstacles: Obstacle[] = [],
    colliders: THREE.Mesh[] = [];
  const concrete = mat("#b0a889", 0.92, 0.03),
    concreteDark = mat("#8d846c", 0.96, 0),
    steel = mat("#4b5445", 0.65, 0.45),
    steelLight = mat("#7c8474", 0.64, 0.36),
    rust = mat("#a96243", 0.9, 0.12),
    black = mat("#2e342d", 0.8, 0.1),
    pale = mat("#dfd9b9", 0.85, 0.06),
    yellow = mat("#c8a24b", 0.74, 0.2);
  const colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
  function collider(x: number, z: number, w: number, d: number, h: number) {
    obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2, height: h });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      colliderMaterial,
    );
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    colliders.push(mesh);
  }

  function building(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: THREE.Material,
    roof = true,
  ) {
    collider(x, z, w, d, h);
    box(staticGroup, w, h, d, x, h / 2, z, color, 0.12);
    box(staticGroup, w + 0.18, 0.22, d + 0.18, x, 0.14, z, concreteDark, 0.04);
    if (roof) box(staticGroup, w + 0.45, 0.26, d + 0.45, x, h, z, steel, 0.06);
    for (const side of [-1, 1]) {
      box(
        staticGroup,
        0.24,
        h + 0.1,
        d + 0.09,
        x + side * (w / 2 - 0.12),
        h / 2,
        z,
        steel,
        0.025,
      );
      for (let i = 0; i < Math.max(1, Math.floor(w / 2.5)); i++) {
        const xx = x - w / 2 + 1.2 + i * 2.3;
        box(
          staticGroup,
          1.42,
          0.64,
          0.06,
          xx,
          h * 0.69,
          z + side * (d / 2 + 0.04),
          black,
          0.025,
        );
        box(
          staticGroup,
          1.18,
          0.4,
          0.07,
          xx,
          h * 0.69,
          z + side * (d / 2 + 0.07),
          steelLight,
          0.01,
        );
        box(
          staticGroup,
          0.06,
          0.6,
          0.09,
          xx,
          h * 0.69,
          z + side * (d / 2 + 0.1),
          steel,
        );
      }
    }
    box(
      staticGroup,
      0.5,
      h * 0.75,
      0.3,
      x - w / 2 + 0.4,
      h * 0.42,
      z + d / 2 + 0.08,
      concreteDark,
      0.03,
    );
    for (let i = 0; i < 3; i++)
      box(
        staticGroup,
        0.8,
        0.06,
        0.16,
        x + w / 2 - 0.8,
        h * 0.3 + i * 0.18,
        z + d / 2 + 0.08,
        steel,
      );
  }

  // The industrial outpost creates clear loops, open firing lanes, and cover on both flanks.
  building(-19, -14, 10, 10, 5.4, concrete);
  building(19, -16, 10, 9, 6.4, concrete);
  building(-29, 12, 8, 11, 4.3, rust);
  building(27, 14, 8, 10, 4.8, concrete);
  building(-2, -31, 13, 7, 7, steelLight);
  building(-4, -31, 5, 6, 10, concrete);
  building(39, -34, 8, 9, 8, concrete);
  building(-42, -34, 10, 8, 6, rust);
  // Central reactor and circular stepped base.
  cylinder(staticGroup, 4.4, 4.7, 0.5, 0, 0.25, -7, concreteDark, 12);
  cylinder(staticGroup, 3.2, 3.7, 1.2, 0, 0.75, -7, steel, 12);
  cylinder(staticGroup, 2.65, 3.1, 7, 0, 4, -7, concrete, 8);
  cylinder(staticGroup, 3.6, 2.7, 0.7, 0, 7.7, -7, steel, 8);
  cylinder(staticGroup, 2.2, 2.4, 1.3, 0, 8.7, -7, steelLight, 8);
  collider(0, -7, 6.5, 6.5, 9.5);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 2.85,
      z = -7 + Math.sin(angle) * 2.85;
    box(staticGroup, 0.22, 5, 0.3, x, 4.5, z, steel);
    box(
      staticGroup,
      0.3,
      2,
      0.13,
      x * 1.03,
      5,
      z + Math.sin(angle) * 0.1,
      yellow,
    );
  }
  cylinder(staticGroup, 0.12, 0.17, 11, 0, 14.4, -7, steel, 8);
  for (let i = 0; i < 3; i++) {
    const boom = box(
      staticGroup,
      4.5 - i * 0.8,
      0.09,
      0.09,
      0,
      15 + i * 1.5,
      -7,
      steel,
    );
    boom.rotation.y = i * 0.8;
  }
  // Walkway ties the distant buildings together.
  box(staticGroup, 29, 0.38, 3, 0, 5.25, -20, steel, 0.07);
  for (const side of [-1, 1]) {
    box(staticGroup, 29, 0.1, 0.09, 0, 6.1, -20 + side * 1.4, steelLight);
    for (let x = -13; x <= 13; x += 2)
      box(staticGroup, 0.09, 0.9, 0.09, x, 5.7, -20 + side * 1.4, steel);
  }
  for (const x of [-9, 9]) {
    box(staticGroup, 0.55, 5.2, 0.55, x, 2.6, -20, steel);
    collider(x, -20, 0.55, 0.55, 5.2);
  }

  function crate(
    x: number,
    z: number,
    w = 2.7,
    d = 2.2,
    h = 2.1,
    material = steelLight,
  ) {
    collider(x, z, w, d, h);
    box(staticGroup, w, h, d, x, h / 2, z, material, 0.06);
    for (const side of [-1, 1]) {
      box(staticGroup, w + 0.08, 0.14, d + 0.08, x, 0.2, z, steel, 0.015);
      box(staticGroup, w + 0.08, 0.14, d + 0.08, x, h - 0.16, z, steel, 0.015);
      box(
        staticGroup,
        0.13,
        h,
        d + 0.1,
        x + side * (w / 2 - 0.22),
        h / 2,
        z,
        steel,
        0.015,
      );
      for (let i = 0; i < 4; i++)
        box(
          staticGroup,
          0.035,
          h * 0.63,
          0.04,
          x - w * 0.34 + i * w * 0.22,
          h * 0.52,
          z + side * (d / 2 + 0.035),
          steel,
        );
    }
    box(staticGroup, 0.55, 0.25, 0.025, x, h * 0.63, z + d / 2 + 0.03, pale);
  }
  crate(-10, 12);
  crate(11, 12, 3.8, 2, 2.1, rust);
  crate(-10, -2, 3, 2.5, 2.4);
  crate(10, -2, 2.5, 2.2, 2.1, rust);
  crate(-33, -9, 3, 6, 2.7, rust);
  crate(33, -4, 3, 5, 2.7, steelLight);
  crate(-16, 29, 4, 2, 2, rust);
  crate(16, 30, 4, 2.2, 2, steelLight);
  crate(-13, -36, 3, 2, 2);
  crate(15, -34, 2.7, 2, 2.4, rust);
  crate(42, 24, 5, 2.3, 2.1, rust);
  crate(-42, 30, 4.4, 2.2, 2.4, steelLight);

  // WWII battlefield dressing: sandbags, tank wreck, watchtowers, hedgehogs, tents, a crashed plane and artillery.
  const sandbag = mat("#a8946f", 0.98, 0),
    sandbagDark = mat("#93805f", 0.98, 0),
    armyGreen = mat("#5d6248", 0.85, 0.08),
    armyDark = mat("#454a36", 0.9, 0.05),
    wood = mat("#8a6f4d", 0.95, 0),
    woodDark = mat("#6a5438", 0.95, 0),
    canvasTan = mat("#7a7355", 0.98, 0),
    wireMat = mat("#3a3833", 0.7, 0.4);

  function sandbagWall(x: number, z: number, rot: number, len = 3.4) {
    collider(x, z, rot ? 1 : len, rot ? len : 1, 1.05);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (rot) g.rotation.y = Math.PI / 2;
    staticGroup.add(g);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 5; i++) {
        const bag = box(
          g,
          0.68, 0.34, 0.52,
          -len / 2 + 0.4 + i * (len / 5) + (row % 2 ? 0.14 : 0),
          0.18 + row * 0.31,
          (rng() - 0.5) * 0.1,
          row % 2 ? sandbagDark : sandbag,
          0.14,
        );
        bag.rotation.y = (rng() - 0.5) * 0.3;
      }
  }
  sandbagWall(5, 2, 0);
  sandbagWall(-8, -15, 1);
  sandbagWall(12, 22, 0);
  sandbagWall(-18, 6, 1);
  sandbagWall(22, -24, 0);

  function watchtower(x: number, z: number) {
    collider(x, z, 2.2, 2.2, 6.4);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(staticGroup, 0.22, 6.4, 0.22, x + sx * 0.85, 3.1, z + sz * 0.85, woodDark, 0.02);
      leg.rotation.z = -sx * 0.06;
      leg.rotation.x = sz * 0.06;
    }
    box(staticGroup, 2.6, 0.18, 2.6, x, 6.1, z, wood, 0.03);
    for (const side of [-1, 1]) {
      box(staticGroup, 2.7, 0.75, 0.12, x, 6.65, z + side * 1.28, wood, 0.02);
      box(staticGroup, 0.12, 0.75, 2.7, x + side * 1.28, 6.65, z, wood, 0.02);
    }
    box(staticGroup, 3.1, 0.14, 3.1, x, 7.55, z, armyDark, 0.02);
    cylinder(staticGroup, 0.25, 2.2, 1.2, x, 8.2, z, armyDark, 4);
    for (let i = 0; i < 6; i++)
      box(staticGroup, 0.55, 0.07, 0.09, x, 0.9 + i * 0.9, z + 1.08, woodDark);
  }
  watchtower(-26, 30);
  watchtower(36, 8);

  function tankWreck(x: number, z: number, rotY: number) {
    collider(x, z, 4.6, 2.8, 2.2);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    box(g, 4.4, 0.9, 2.6, 0, 0.78, 0, armyGreen, 0.12);
    box(g, 4.7, 0.6, 0.55, 0, 0.42, 1.18, armyDark, 0.06);
    box(g, 4.7, 0.6, 0.55, 0, 0.42, -1.18, armyDark, 0.06);
    for (let i = 0; i < 5; i++)
      for (const side of [-1, 1]) {
        const wheel = cylinder(g, 0.3, 0.3, 0.6, -1.8 + i * 0.9, 0.4, side * 1.18, black, 10);
        wheel.rotation.x = Math.PI / 2;
      }
    const turret = box(g, 1.9, 0.62, 1.6, -0.3, 1.52, 0, armyGreen, 0.1);
    turret.rotation.y = 0.5;
    const barrel = cylinder(g, 0.09, 0.12, 2.7, 1.0, 1.6, 0.55, armyDark, 8);
    barrel.rotation.z = Math.PI / 2 - 0.06;
    barrel.rotation.y = -0.45;
    box(g, 0.55, 0.42, 0.55, 1.6, 1.3, -0.6, rust, 0.05);
    box(g, 0.9, 0.14, 0.5, -1.4, 1.28, 0.9, woodDark, 0.02);
  }
  tankWreck(-14, 20, 0.6);

  function hedgehog(x: number, z: number) {
    collider(x, z, 1.1, 1.1, 1.15);
    const g = new THREE.Group();
    g.position.set(x, 0.55, z);
    staticGroup.add(g);
    const b1 = box(g, 0.16, 1.9, 0.16, 0, 0, 0, steel, 0.02);
    b1.rotation.z = 0.6;
    const b2 = box(g, 0.16, 1.9, 0.16, 0, 0, 0, steel, 0.02);
    b2.rotation.x = 0.6;
    const b3 = box(g, 0.16, 1.9, 0.16, 0, 0, 0, rust, 0.02);
    b3.rotation.set(0.5, 0.8, -0.5);
  }
  hedgehog(8, 18);
  hedgehog(-12, -22);
  hedgehog(22, 6);
  hedgehog(-24, -14);
  hedgehog(16, -8);
  hedgehog(-4, 24);

  function tent(x: number, z: number, rotY: number) {
    collider(x, z, 3.2, 2.6, 1.9);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    const p1 = box(g, 3.4, 0.1, 1.8, 0, 0.95, 0.72, canvasTan, 0.02);
    p1.rotation.x = -0.72;
    const p2 = box(g, 3.4, 0.1, 1.8, 0, 0.95, -0.72, canvasTan, 0.02);
    p2.rotation.x = 0.72;
    box(g, 3.5, 0.09, 0.14, 0, 1.6, 0, woodDark, 0.01);
    box(g, 0.1, 1.45, 1.85, -1.68, 0.72, 0, canvasTan, 0.02);
  }
  tent(-38, 16, 0.3);
  tent(36, -22, -0.5);

  function crashedPlane(x: number, z: number, rotY: number) {
    collider(x, z, 5.2, 2.6, 2.4);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    const fuselage = cylinder(g, 0.55, 0.78, 5.4, 0, 0.9, 0, armyGreen, 10);
    fuselage.rotation.z = Math.PI / 2;
    const nose = cylinder(g, 0.1, 0.5, 1.7, 3.2, 0.55, 0, rust, 8);
    nose.rotation.z = Math.PI / 2 + 0.35;
    const wing = box(g, 2.3, 0.12, 6.9, -0.4, 1.05, 0, armyGreen, 0.03);
    wing.rotation.z = 0.14;
    const fin = box(g, 1.4, 1.15, 0.14, -2.6, 1.65, 0, armyGreen, 0.03);
    fin.rotation.z = -0.3;
    box(g, 1.2, 0.1, 2.3, -2.5, 1.2, 0, armyDark, 0.02);
    const prop = box(g, 0.1, 1.6, 0.24, 3.85, 0.45, 0, woodDark, 0.02);
    prop.rotation.x = 0.4;
  }
  crashedPlane(-46, 6, 0.9);

  function artillery(x: number, z: number, rotY: number) {
    collider(x, z, 2.6, 1.6, 1.6);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    box(g, 1.8, 0.5, 1.1, 0, 0.55, 0, armyDark, 0.05);
    const barrel = cylinder(g, 0.12, 0.17, 3.4, 1.0, 1.3, 0, steel, 10);
    barrel.rotation.z = Math.PI / 2 - 0.5;
    for (const side of [-1, 1]) {
      const wheel = cylinder(g, 0.52, 0.52, 0.22, -0.7, 0.52, side * 0.64, black, 12);
      wheel.rotation.x = Math.PI / 2;
      const leg = box(g, 1.7, 0.14, 0.3, -1.5, 0.14, side * 0.55, woodDark, 0.02);
      leg.rotation.y = side * 0.4;
    }
  }
  artillery(30, -28, 2.4);

  function wireLine(x: number, z: number, rotY: number, posts = 5) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    for (let i = 0; i < posts; i++) {
      const px = -((posts - 1) * 1.6) / 2 + i * 1.6;
      const post = box(g, 0.09, 1.3, 0.09, px, 0.65, 0, woodDark, 0.01);
      post.rotation.z = (rng() - 0.5) * 0.25;
      if (i < posts - 1)
        for (let w = 0; w < 3; w++)
          box(g, 1.65, 0.025, 0.025, px + 0.8, 0.45 + w * 0.35, 0, wireMat);
    }
  }
  wireLine(-25, 27, 0.2);
  wireLine(25, -9, -0.35);

  function woodCrates(x: number, z: number) {
    collider(x, z, 1.9, 1.3, 1.6);
    box(staticGroup, 1.1, 1.1, 1.1, x - 0.4, 0.55, z, wood, 0.03);
    box(staticGroup, 0.9, 0.9, 0.9, x + 0.55, 0.45, z + 0.2, woodDark, 0.03);
    box(staticGroup, 0.8, 0.8, 0.8, x, 1.5, z + 0.1, wood, 0.03);
  }
  woodCrates(-6, -18);
  woodCrates(20, 22);

  for (const [x, z, rot] of [
    [-8, 23, 0],
    [9, 25, 0],
    [-22, 0, 1],
    [23, 0, 1],
    [-4, 14, 0],
    [5, -26, 0],
    [-23, -29, 0],
    [25, -29, 0],
  ]) {
    const w = rot ? 1.2 : 5,
      d = rot ? 5 : 1.2;
    collider(x, z, w, d, 1.15);
    box(staticGroup, w, 1.1, d, x, 0.55, z, concreteDark, 0.1);
    box(staticGroup, w + 0.1, 0.16, d + 0.1, x, 1.08, z, concrete, 0.03);
    for (const side of [-1, 1])
      box(
        staticGroup,
        0.35,
        0.76,
        0.03,
        x + side * (w / 2 - 0.3),
        0.57,
        z + d / 2 + 0.035,
        yellow,
        0.01,
      );
  }

  // A graphic scaffold, banners and external signage make the arena a place with history.
  for (const x of [-46, 46]) {
    for (const z of [-42, 36]) {
      box(staticGroup, 0.65, 16, 0.65, x, 8, z, steel);
      box(staticGroup, 8, 0.55, 0.55, x, 16, z, steel);
      for (let i = 0; i < 5; i++) {
        const brace = box(
          staticGroup,
          3.8,
          0.16,
          0.18,
          x,
          2 + i * 3,
          z,
          steelLight,
        );
        brace.rotation.z = Math.PI / 3;
      }
      const tex = canvasTexture(256, 512, (ctx) => {
        ctx.fillStyle = "#3a4438";
        ctx.fillRect(0, 0, 256, 512);
        ctx.fillStyle = "#e8e2cc";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 38 : 92;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          if (i === 0) ctx.moveTo(128 + Math.cos(a) * r, 178 + Math.sin(a) * r);
          else ctx.lineTo(128 + Math.cos(a) * r, 178 + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(128, 178, 108, 0, Math.PI * 2);
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#e8e2cc";
        ctx.stroke();
        ctx.font = "bold 72px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("1942", 128, 386);
        ctx.font = "bold 30px sans-serif";
        ctx.fillText("前线战区", 128, 438);
        ctx.fillRect(28, 468, 200, 3);
      });
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(4.1, 8.2),
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      );
      flag.position.set(x, 11.5, z + 0.38);
      flag.userData.dynamic = true;
      scene.add(flag);
    }
  }
  const signTexture = canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = "#d1c7a7";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = "#3a4745";
    ctx.font = "bold 96px sans-serif";
    ctx.fillText("诺曼底", 46, 137);
    ctx.font = "29px monospace";
    ctx.fillText("前线  //  1942", 51, 205);
    ctx.fillStyle = "#9d613e";
    ctx.fillRect(907, 30, 70, 194);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 2.35),
    new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.9 }),
  );
  sign.position.set(-2, 5, -27.45);
  scene.add(sign);
  // Antennas and turbines break the skyline.
  for (let i = 0; i < 7; i++) {
    const x = -90 + i * 31,
      z = -100 - rng() * 25,
      h = 22 + rng() * 24;
    cylinder(staticGroup, 0.22, 0.65, h, x, h / 2, z, steel, 8);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(2.7, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.3),
      steelLight,
    );
    dish.position.set(x, h, z);
    dish.rotation.x = 0.55;
    staticGroup.add(dish);
    box(staticGroup, 0.08, 5, 0.08, x, h + 2, z, steel);
  }

  // Layered sandstone formations. The seeded geometry keeps every match's landmarks consistent.
  const rockMats = ["#aa8664", "#b7956f", "#c1a17d", "#9a7c61", "#c6ae88"].map(
    (c) => mat(c, 1, 0),
  );
  function rock(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    layer = 0,
  ) {
    const geo = new THREE.CylinderGeometry(
      w * 0.56,
      w * 0.69,
      h,
      5 + Math.floor(rng() * 3),
      3,
    );
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(
        i,
        p.getX(i) + (rng() - 0.5) * w * 0.16 + Math.sin(y * 0.4) * w * 0.16,
      );
      p.setZ(i, (p.getZ(i) * d) / w + (rng() - 0.5) * d * 0.14);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, rockMats[layer % rockMats.length]);
    mesh.position.set(x, h / 2 - 1, z);
    mesh.rotation.y = rng() * 6;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    staticGroup.add(mesh);
    if (h > 15) {
      for (let j = 0; j < 3; j++) {
        const seam = cylinder(
          staticGroup,
          w * 0.57,
          w * 0.59,
          0.22 + rng() * 0.2,
          x,
          h * (0.25 + j * 0.22),
          z,
          rockMats[(layer + 1) % rockMats.length],
          7,
        );
        seam.scale.z = d / w;
        seam.rotation.y = mesh.rotation.y;
      }
    }
  }
  for (let i = 0; i < 65; i++) {
    const a = (i / 65) * Math.PI * 2;
    const r = 94 + rng() * 38;
    const h = 8 + rng() * 23 + (Math.sin(a * 3) + 1) * 7;
    rock(
      Math.sin(a) * r,
      Math.cos(a) * r,
      11 + rng() * 18,
      h,
      10 + rng() * 14,
      i,
    );
  }
  for (let i = 0; i < 45; i++) {
    const a = rng() * Math.PI * 2,
      r = 67 + rng() * 17;
    rock(
      Math.sin(a) * r,
      Math.cos(a) * r,
      2 + rng() * 5,
      1 + rng() * 5,
      2 + rng() * 4,
      i,
    );
  }
  // Fine ground dressing is instanced to keep the draw budget small.
  const pebbles = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    rockMats[1],
    330,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 330; i++) {
    const a = rng() * Math.PI * 2,
      r = 8 + rng() * 93;
    dummy.position.set(Math.sin(a) * r, 0.03, Math.cos(a) * r);
    dummy.scale.set(
      0.06 + rng() * 0.26,
      0.04 + rng() * 0.15,
      0.07 + rng() * 0.24,
    );
    dummy.rotation.set(rng(), rng() * 6, rng());
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  }
  pebbles.receiveShadow = true;
  scene.add(pebbles);
  const grassGeo = new THREE.ConeGeometry(0.25, 0.9, 3);
  const grass = new THREE.InstancedMesh(grassGeo, mat("#8d9160", 1, 0), 170);
  for (let i = 0; i < 170; i++) {
    const a = rng() * Math.PI * 2,
      r = 27 + rng() * 54;
    dummy.position.set(Math.sin(a) * r, 0.22, Math.cos(a) * r);
    dummy.rotation.set((rng() - 0.5) * 0.35, rng() * 6, (rng() - 0.5) * 0.4);
    dummy.scale.set(0.6 + rng(), 0.3 + rng() * 0.6, 0.6 + rng());
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  scene.add(grass);
  mergeStatic(staticGroup);

  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec2 vUv; uniform float time; void main(){float line=pow(max(0.0,sin(vUv.y*120.0-time*2.0)),16.0); float bottom=pow(1.0-vUv.y,4.0); gl_FragColor=vec4(0.88,0.30,0.10,(0.055+line*0.13+bottom*0.21)*(1.0-vUv.y));}",
  });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 25, 128, 1, true),
    ringMat,
  );
  ring.position.y = 12.5;
  ring.scale.set(67, 1, 67);
  ring.visible = false;
  scene.add(ring);
  const dustPositions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    dustPositions[i * 3] = (rng() - 0.5) * 150;
    dustPositions[i * 3 + 1] = 0.2 + rng() * 16;
    dustPositions[i * 3 + 2] = (rng() - 0.5) * 150;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: "#f3e6c8",
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const pickups: THREE.Group[] = [];
  for (const [x, z] of [
    [-7, 6],
    [13, -10],
    [-20, 22],
    [22, 23],
    [0, -22],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    cylinder(g, 0.52, 0.6, 0.12, 0, 0.1, 0, steel, 8);
    box(g, 0.4, 0.55, 0.34, 0, 0.68, 0, ivoryMaterial(), 0.06);
    box(
      g,
      0.2,
      0.05,
      0.355,
      0,
      0.68,
      0,
      mat("#a9d39c", 0.4, 0.2, "#668950"),
      0.005,
    );
    box(
      g,
      0.05,
      0.2,
      0.355,
      0,
      0.68,
      0,
      mat("#a9d39c", 0.4, 0.2, "#668950"),
      0.005,
    );
    pickups.push(g);
  }
  function ivoryMaterial() {
    return mat("#d7d8c4", 0.5, 0.3);
  }
  const pad = new THREE.Group();
  pad.position.set(0, 0, 31);
  scene.add(pad);
  cylinder(pad, 2.35, 2.6, 0.24, 0, 0.1, 0, steel, 12);
  cylinder(pad, 2.13, 2.25, 0.09, 0, 0.25, 0, steelLight, 12);
  cylinder(pad, 1.76, 1.76, 0.025, 0, 0.308, 0, black, 48);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const marker = box(
      pad,
      0.085,
      0.025,
      0.26,
      Math.sin(a) * 1.94,
      0.313,
      Math.cos(a) * 1.94,
      yellow,
      0.005,
    );
    marker.rotation.y = a;
  }
  addOriginalScenery(scene);
  return { scene, obstacles, colliders, ring, dust, pickups, pad, sun };
}
