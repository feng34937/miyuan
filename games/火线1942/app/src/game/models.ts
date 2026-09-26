import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { LegendId, WeaponId } from "./types";

const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<
  string,
  THREE.MeshStandardMaterial | THREE.MeshLambertMaterial
>();
let fastMaterials = false;
export function setFastMaterials(enabled: boolean) {
  fastMaterials = enabled;
}

export function mat(
  color: string | number,
  roughness = 0.65,
  metalness = 0.15,
  emissive?: string,
) {
  const key = `${color}-${roughness}-${metalness}-${emissive}-${fastMaterials}`;
  if (!materials.has(key)) {
    const glow = emissive ? { emissive, emissiveIntensity: 1.8 } : {};
    materials.set(
      key,
      fastMaterials
        ? new THREE.MeshLambertMaterial({ color, ...glow })
        : new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness,
            ...glow,
          }),
    );
  }
  return materials.get(key)!;
}

export function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  bevel = 0,
) {
  if (fastMaterials && Math.max(w, h, d) > 1) bevel = 0;
  const key = `${w},${h},${d},${bevel}`;
  if (!geometries.has(key))
    geometries.set(
      key,
      bevel
        ? new RoundedBoxGeometry(w, h, d, 1, bevel)
        : new THREE.BoxGeometry(w, h, d),
    );
  const mesh = new THREE.Mesh(geometries.get(key), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(
  parent: THREE.Object3D,
  radius: number,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const key = `sphere-${radius}`;
  if (!geometries.has(key))
    geometries.set(key, new THREE.SphereGeometry(radius, 14, 10));
  const mesh = new THREE.Mesh(geometries.get(key), material);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(
  parent: THREE.Object3D,
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  segments = 10,
) {
  const key = `cylinder-${rt}-${rb}-${h}-${segments}`;
  if (!geometries.has(key))
    geometries.set(key, new THREE.CylinderGeometry(rt, rb, h, segments));
  const mesh = new THREE.Mesh(geometries.get(key), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function strap(
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  width: number,
  material: THREE.Material,
) {
  const middle = from.clone().add(to).multiplyScalar(0.5);
  const mesh = box(
    parent,
    width,
    from.distanceTo(to),
    0.055,
    middle.x,
    middle.y,
    middle.z,
    material,
    0.018,
  );
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return mesh;
}

function panel(
  parent: THREE.Object3D,
  vertices: number[],
  indices: number[],
  material: THREE.Material,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createWeapon(id: WeaponId, firstPerson = false): THREE.Group {
  const g = new THREE.Group();
  const dark = mat("#293237", 0.38, 0.65),
    metal = mat("#9baca9", 0.36, 0.72),
    light = mat("#d7d9cb", 0.55, 0.3),
    accent = mat("#e6a54b", 0.45, 0.3),
    black = mat("#151e23", 0.85, 0.1);
  const length = id === "longshot" ? 1.12 : id === "breacher" ? 0.72 : 0.9;
  box(g, 0.18, 0.21, length * 0.59, 0, 0, -0.08, dark, 0.024);
  box(g, 0.195, 0.13, length * 0.3, 0, 0.035, -length * 0.38, light, 0.015);
  box(g, 0.105, 0.045, length * 0.8, 0, 0.13, -0.1, black, 0.009);
  const barrel = cylinder(
    g,
    0.04,
    0.04,
    length * 0.35,
    0,
    0.025,
    -length * 0.67,
    metal,
    12,
  );
  barrel.rotation.x = Math.PI / 2;
  const muzzle = cylinder(
    g,
    0.056,
    0.056,
    0.1,
    0,
    0.025,
    -length * 0.87,
    dark,
    8,
  );
  muzzle.rotation.x = Math.PI / 2;
  box(g, 0.14, 0.15, 0.25, 0, -0.018, length * 0.37, dark, 0.028);
  box(g, 0.16, 0.2, 0.055, 0, -0.035, length * 0.5, black, 0.012);
  const grip = box(g, 0.09, 0.24, 0.11, 0, -0.2, 0.15, black, 0.016);
  grip.rotation.x = -0.22;
  const mag = box(g, 0.115, 0.3, 0.16, 0, -0.23, -0.02, metal, 0.01);
  mag.rotation.x = 0.15;
  for (let i = 0; i < 4; i++)
    box(g, 0.12, 0.015, 0.164, 0, -0.13 - i * 0.05, -0.02, dark, 0.002);
  for (const side of [-1, 1]) {
    box(g, 0.012, 0.038, 0.27, side * 0.105, 0.045, -0.05, accent, 0.002);
    for (let i = 0; i < 5; i++)
      box(g, 0.009, 0.058, 0.018, side * 0.1, 0.02, -0.24 - i * 0.035, black);
  }
  if (id === "longshot") {
    const scope = cylinder(g, 0.055, 0.055, 0.3, 0, 0.22, -0.1, dark, 12);
    scope.rotation.x = Math.PI / 2;
    const lens = cylinder(
      g,
      0.043,
      0.043,
      0.012,
      0,
      0.22,
      -0.253,
      mat("#649a96", 0.15, 0.8),
    );
    lens.rotation.x = Math.PI / 2;
    box(g, 0.05, 0.12, 0.06, 0, 0.15, -0.1, metal, 0.008);
  } else {
    box(g, 0.09, 0.1, 0.025, 0, 0.2, 0.04, dark, 0.012);
    box(
      g,
      0.05,
      0.055,
      0.027,
      0,
      0.205,
      0.04,
      mat("#b7e4c2", 0.2, 0.3, "#60965f"),
      0.005,
    );
    box(g, 0.025, 0.09, 0.03, 0, 0.18, -length * 0.45, metal, 0.005);
  }
  if (id === "breacher") {
    const second = cylinder(g, 0.035, 0.035, 0.3, 0, -0.075, -0.53, metal);
    second.rotation.x = Math.PI / 2;
    box(g, 0.21, 0.13, 0.23, 0, -0.04, -0.34, mat("#a5794a"), 0.035);
  }
  if (firstPerson) {
    const glove = mat("#353c37"),
      sleeve = mat("#ab9970");
    sphere(g, 0.115, 0.85, 1.4, 0.85, 0.025, -0.25, 0.14, glove);
    const arm = box(g, 0.18, 0.22, 0.57, 0.08, -0.39, 0.43, sleeve, 0.06);
    arm.rotation.x = -0.35;
    sphere(g, 0.12, 1, 0.85, 1.2, -0.04, -0.13, -0.31, glove);
    const left = box(g, 0.16, 0.2, 0.57, -0.25, -0.32, -0.1, sleeve, 0.05);
    left.rotation.set(-0.5, -0.6, -0.4);
  }
  return g;
}

export interface CharacterModel {
  group: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torso: THREE.Group;
  weapon: THREE.Group;
}

export function createCharacter(
  competitor: LegendId,
  skin = "carbon",
  enemy = false,
): CharacterModel {
  const group = new THREE.Group();
  const armorColor = enemy
    ? "#8a4f3d"
    : skin === "sandstorm"
      ? "#c2a375"
      : skin === "signal"
        ? "#b85f43"
        : competitor === "boren"
          ? "#66735f"
          : competitor === "nima"
            ? "#7d7f63"
            : "#6e7346";
  const fabricColor =
    competitor === "tavi" ? "#8a7a4e" : competitor === "boren" ? "#7d6b50" : "#77878c";
  const armor = mat(armorColor, 0.48, 0.48),
    fabric = mat(fabricColor, 0.96, 0.02),
    dark = mat("#273235", 0.8, 0.18),
    under = mat("#383842", 0.93, 0.04),
    ivory = mat("#d5d7c7", 0.47, 0.3),
    metal = mat("#788b89", 0.31, 0.7),
    gold = mat("#e0b967", 0.45, 0.35),
    rubber = mat("#253032", 0.98, 0);
  const glow = mat(
    enemy ? "#ffd196" : "#fff0d2",
    0.25,
    0.3,
    enemy ? "#ff6733" : "#da873d",
  );
  const torso = new THREE.Group();
  torso.position.y = 1.7;
  group.add(torso);
  const bulk = competitor === "boren" ? 1.17 : 1;
  sphere(torso, 0.45, 1.06 * bulk, 1.24, 0.62, 0, 0.51, 0, under);
  box(torso, 0.78 * bulk, 0.4, 0.4, 0, 0.72, 0.018, armor, 0.075);
  box(torso, 0.62, 0.23, 0.42, 0, 0.4, 0.038, dark, 0.05);
  for (let i = 0; i < 3; i++)
    box(
      torso,
      0.48 - i * 0.035,
      0.115,
      0.075,
      0,
      0.41 - i * 0.11,
      0.229,
      armor,
      0.025,
    );
  box(torso, 0.18, 0.1, 0.037, 0.17, 0.79, 0.238, ivory, 0.007);
  box(torso, 0.055, 0.017, 0.04, 0.17, 0.79, 0.26, glow);
  box(torso, 0.125, 0.23, 0.06, -0.23, 0.61, 0.247, dark, 0.02);
  for (let i = 0; i < 3; i++)
    box(torso, 0.095, 0.024, 0.02, -0.23, 0.68 - i * 0.056, 0.28, metal, 0.002);
  const belt = box(group, 0.73, 0.145, 0.43, 0, 1.66, 0, dark, 0.045);
  box(belt, 0.13, 0.095, 0.04, 0.02, 0, 0.235, metal, 0.013);
  for (const side of [-1, 1]) {
    box(group, 0.16, 0.22, 0.14, side * 0.27, 1.58, 0.23, fabric, 0.025);
    box(group, 0.17, 0.035, 0.151, side * 0.27, 1.66, 0.23, dark, 0.003);
    const hip = box(
      group,
      0.21,
      0.38,
      0.25,
      side * 0.37,
      1.43,
      -0.015,
      armor,
      0.03,
    );
    hip.rotation.z = side * 0.1;
  }
  const leftLeg = new THREE.Group(),
    rightLeg = new THREE.Group();
  for (const [leg, side] of [
    [leftLeg, -1],
    [rightLeg, 1],
  ] as const) {
    leg.position.set(side * 0.23, 1.53, 0);
    group.add(leg);
    const thigh = box(leg, 0.3, 0.58, 0.32, 0, -0.26, 0, under, 0.075);
    thigh.rotation.z = -side * 0.035;
    box(leg, 0.235, 0.33, 0.09, 0, -0.24, 0.16, armor, 0.036);
    box(leg, 0.33, 0.075, 0.335, 0, -0.4, 0, dark, 0.025);
    sphere(leg, 0.16, 1, 0.9, 1, 0, -0.6, 0.02, dark);
    box(leg, 0.255, 0.23, 0.17, 0, -0.6, 0.115, ivory, 0.047);
    box(leg, 0.085, 0.08, 0.02, 0, -0.59, 0.212, metal, 0.013);
    box(leg, 0.235, 0.5, 0.26, 0, -0.93, -0.015, dark, 0.07);
    box(leg, 0.19, 0.37, 0.08, 0, -0.94, 0.12, armor, 0.03);
    strap(
      leg,
      new THREE.Vector3(-0.075, -0.79, 0.167),
      new THREE.Vector3(0.075, -1.1, 0.167),
      0.045,
      ivory,
    );
    box(leg, 0.28, 0.22, 0.48, 0, -1.33, 0.1, rubber, 0.052);
    box(leg, 0.27, 0.12, 0.28, 0, -1.29, 0.22, armor, 0.035);
    box(leg, 0.3, 0.06, 0.49, 0, -1.46, 0.11, dark, 0.012);
    for (let i = 0; i < 3; i++)
      box(
        leg,
        0.2,
        0.018,
        0.025,
        0,
        -1.22 + i * 0.048,
        0.16 - i * 0.022,
        metal,
        0.004,
      );
  }
  leftLeg.rotation.z = -0.06;
  rightLeg.rotation.z = 0.065;
  rightLeg.rotation.x = -0.08;
  const leftArm = new THREE.Group(),
    rightArm = new THREE.Group();
  for (const [arm, side] of [
    [leftArm, -1],
    [rightArm, 1],
  ] as const) {
    arm.position.set(side * 0.53 * bulk, 2.45, 0);
    torso.add(arm);
    arm.position.y -= 1.7;
    sphere(arm, 0.21, 1.04, 1, 1, 0, -0.04, 0, under);
    box(arm, 0.29 * bulk, 0.24, 0.38, side * 0.018, 0.015, 0, armor, 0.06);
    box(arm, 0.19, 0.029, 0.27, side * 0.018, 0.142, 0, ivory, 0.01);
    box(arm, 0.22, 0.39, 0.235, 0, -0.29, 0, fabric, 0.075);
    box(arm, 0.24, 0.07, 0.25, 0, -0.29, 0, dark, 0.015);
    sphere(arm, 0.13, 1, 1, 1, 0, -0.51, 0, dark);
    box(arm, 0.21, 0.36, 0.25, 0, -0.73, 0.035, ivory, 0.046);
    box(arm, 0.22, 0.085, 0.26, 0, -0.61, 0.035, armor, 0.016);
    box(arm, 0.13, 0.19, 0.04, 0, -0.76, 0.171, dark, 0.012);
    box(arm, 0.088, 0.032, 0.02, 0, -0.74, 0.195, glow, 0.004);
    box(arm, 0.19, 0.09, 0.21, 0, -0.93, 0.037, dark, 0.022);
    sphere(arm, 0.13, 0.9, 1.1, 0.66, 0, -1.08, 0.055, rubber);
    for (let i = 0; i < 3; i++)
      box(arm, 0.025, 0.12, 0.06, -0.05 + i * 0.05, -1.13, 0.106, armor, 0.01);
  }
  leftArm.rotation.set(-0.12, -0.14, -0.1);
  rightArm.rotation.set(-0.36, 0.05, 0.16);
  const head = new THREE.Group();
  head.position.set(0, 2.73, 0);
  group.add(head);
  cylinder(head, 0.12, 0.15, 0.22, 0, -0.055, 0, dark);
  sphere(head, 0.3, 0.93, 1.09, 0.94, 0, 0.26, 0, armor);
  box(head, 0.465, 0.225, 0.265, 0, 0.295, 0.135, dark, 0.065);
  box(
    head,
    0.39,
    0.086,
    0.055,
    0,
    0.315,
    0.278,
    mat("#dcc070", 0.17, 0.77),
    0.027,
  );
  box(head, 0.38, 0.022, 0.025, 0, 0.344, 0.305, glow, 0.009);
  box(head, 0.265, 0.15, 0.16, 0, 0.16, 0.213, ivory, 0.035);
  for (let i = 0; i < 4; i++)
    box(
      head,
      0.022,
      0.073,
      0.016,
      -0.063 + i * 0.042,
      0.158,
      0.296,
      dark,
      0.004,
    );
  for (const side of [-1, 1]) {
    const ear = cylinder(
      head,
      0.097,
      0.097,
      0.075,
      side * 0.265,
      0.255,
      0.018,
      metal,
      12,
    );
    ear.rotation.z = Math.PI / 2;
    const detail = cylinder(
      head,
      0.058,
      0.058,
      0.081,
      side * 0.27,
      0.255,
      0.018,
      dark,
    );
    detail.rotation.z = Math.PI / 2;
    box(head, 0.06, 0.033, 0.09, side * 0.314, 0.255, 0.018, gold, 0.006);
  }
  box(head, 0.085, 0.24, 0.22, 0, 0.49, -0.035, armor, 0.032);
  if (competitor === "tavi") {
    const scarf = mat(fabricColor, 0.95, 0);
    scarf.side = THREE.DoubleSide;
    const cowl = new THREE.Mesh(
      new THREE.TorusGeometry(0.265, 0.1, 6, 16),
      fabric,
    );
    cowl.position.set(0, 2.72, 0.02);
    cowl.rotation.x = Math.PI / 2;
    cowl.scale.set(1.28, 1.04, 1);
    group.add(cowl);
    cowl.castShadow = true;
    panel(
      group,
      [
        -0.5, 2.65, 0.18, 0.43, 2.64, 0.18, 0.26, 2.2, 0.32, -0.18, 2.07, 0.33,
        -0.51, 2.37, 0.24, -0.13, 2.49, 0.36,
      ],
      [0, 1, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 0, 5],
      scarf,
    );
    panel(
      group,
      [
        -0.37, 2.7, -0.12, 0.43, 2.67, -0.12, 0.53, 1.95, -0.3, 0.28, 1.44,
        -0.42, -0.13, 1.54, -0.49, -0.48, 2.05, -0.36, 0, 2.22, -0.42,
      ],
      [0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6],
      scarf,
    );
    strap(
      group,
      new THREE.Vector3(-0.28, 2.62, 0.31),
      new THREE.Vector3(0.31, 1.7, 0.25),
      0.1,
      dark,
    );
    box(group, 0.125, 0.09, 0.03, 0.015, 2.2, 0.355, gold, 0.01).rotation.z =
      0.56;
    box(group, 0.13, 0.36, 0.15, -0.48, 1.55, 0.03, dark, 0.025).rotation.z =
      -0.14;
  } else if (competitor === "boren") {
    box(torso, 0.67, 0.28, 0.15, 0, 0.8, 0.25, ivory, 0.05);
    box(torso, 0.12, 0.17, 0.03, 0, 0.82, 0.34, gold, 0.01);
    for (const side of [-1, 1]) {
      cylinder(group, 0.12, 0.12, 0.74, side * 0.28, 2.21, -0.35, dark);
      cylinder(group, 0.13, 0.13, 0.18, side * 0.28, 2.0, -0.35, fabric);
    }
  } else {
    const antenna = cylinder(
      head,
      0.013,
      0.018,
      0.4,
      -0.23,
      0.66,
      -0.09,
      dark,
      6,
    );
    antenna.rotation.z = 0.15;
    sphere(head, 0.035, 1, 1, 1, -0.26, 0.86, -0.09, glow);
    box(torso, 0.34, 0.38, 0.22, 0, 0.64, -0.3, ivory, 0.04);
    for (const side of [-1, 1])
      box(torso, 0.07, 0.44, 0.09, side * 0.24, 0.68, -0.38, glow, 0.015);
  }
  const weapon = createWeapon("carbine");
  weapon.position.set(0.06, -0.98, 0.12);
  weapon.rotation.set(-1.13, 0.02, 0.08);
  rightArm.add(weapon);
  for(const child of [...head.children])head.remove(child);
  cylinder(head,.28,.34,.47,0,.25,0,armor,8);box(head,.36,.095,.08,0,.28,.3,dark,.025);
  cylinder(head,.07,.07,.16,-.32,.28,0,gold).rotation.z=Math.PI/2;cylinder(head,.07,.07,.16,.32,.28,0,gold).rotation.z=Math.PI/2;
  const pack=new THREE.Group();pack.position.set(0,2.02,-.42);group.add(pack);
  const packMat=mat(competitor==='tavi'?'#6d6242':competitor==='boren'?'#5d6653':'#6b7076',.95,0);
  box(pack,.54,.7,.3,0,-.08,-.1,packMat,.06);
  const bedroll=cylinder(pack,.11,.11,.58,0,.34,-.12,fabric,8);bedroll.rotation.z=Math.PI/2;
  box(pack,.58,.1,.32,0,-.5,-.1,dark,.02);
  box(pack,.1,.5,.34,-.2,-.1,-.1,dark,.02);box(pack,.1,.5,.34,.2,-.1,-.1,dark,.02);
  if(competitor==='nima'){const radio=cylinder(pack,.02,.02,.95,.2,.75,-.12,dark,6);radio.rotation.z=-.08;sphere(pack,.045,1,1,1,.24,1.24,-.12,glow);}
  if(competitor==='boren'){box(pack,.42,.42,.1,0,-.02,-.3,ivory,.03);box(pack,.3,.1,.03,0,-.02,-.36,mat('#b84b3c',.6,.1),.01);box(pack,.1,.3,.03,0,-.02,-.36,mat('#b84b3c',.6,.1),.01);}
  if(competitor==='tavi'){box(pack,.16,.34,.08,-.3,-.3,-.06,gold,.02);}
  group.userData.competitor = competitor;
  return { group, head, leftLeg, rightLeg, leftArm, rightArm, torso, weapon };
}

export function animateCharacter(
  model: CharacterModel,
  time: number,
  walking = 0,
) {
  model.torso.position.y = 1.7 + Math.sin(time * 1.7) * 0.012;
  model.head.rotation.y = Math.sin(time * 0.33) * 0.1;
  model.head.rotation.z = Math.sin(time * 0.52) * 0.022;
  model.leftLeg.rotation.x = Math.sin(time * 11) * 0.5 * walking;
  model.rightLeg.rotation.x = -Math.sin(time * 11) * 0.5 * walking - 0.08;
  model.leftArm.rotation.x = -0.12 - Math.sin(time * 11) * 0.36 * walking;
  model.rightArm.rotation.x = -0.36 + Math.sin(time * 11) * 0.23 * walking;
}
