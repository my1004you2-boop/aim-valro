import * as THREE from 'three';

// 1인칭 총기 모델(독자 디자인, 단순 도형). 원점은 오른손이 잡는 손잡이 윗부분, 총구 방향은 -Z, 위는 +Y.
// buildGun(id) → { root, muzzle, mag }  mag는 재장전 때 빠졌다 들어가는 부분이다.

const METAL = '#2a2e35';
const METAL_2 = '#3c424c';
const POLYMER = '#1f2228';
const GLOVE = '#6b6258';
const SLEEVE = '#3a4250';
const ACCENT = '#ff4655';

const mats = new Map();
const mat = (color, rough = 0.6, metal = 0.3) => {
  const k = `${color}|${rough}|${metal}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return mats.get(k);
};

function box(parent, [w, h, d], [x, y, z], color, rot = [0, 0, 0], name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.rotation.set(...rot);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

// Z축 방향 원통(z0에서 z1까지)
function tube(parent, r, z0, z1, [x, y], color, seg = 12) {
  const len = Math.abs(z1 - z0);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(color, 0.45, 0.6));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, (z0 + z1) / 2);
  parent.add(m);
  return m;
}

function muzzleAt(parent, z, y) {
  const o = new THREE.Object3D();
  o.position.set(0, y, z);
  parent.add(o);
  return o;
}

// 손: 장갑 + 소매(카메라 쪽 아래로 뻗는 팔뚝). armDir = [아래로 숙이는 각, 바깥으로 벌리는 각]
function hand(parent, name, [x, y, z], armDir) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  box(g, [0.052, 0.05, 0.09], [0, 0, 0], GLOVE);
  box(g, [0.054, 0.014, 0.022], [0, 0.012, 0.055], ACCENT);
  const arm = new THREE.Group();
  arm.rotation.set(armDir[0], armDir[1], 0);
  box(arm, [0.065, 0.065, 0.42], [0, -0.005, 0.25], SLEEVE);
  g.add(arm);
  parent.add(g);
  return g;
}

function curvedMag(parent, { z, len, color }) {
  const mag = new THREE.Group();
  mag.position.set(0, -0.02, z);
  let y = 0;
  let zz = 0;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = 0.12 + i * 0.12;
    const seg = len / n;
    box(mag, [0.026, seg + 0.004, 0.05], [0, y - seg / 2, zz - Math.sin(a) * seg * 0.5], color, [-a, 0, 0]);
    y -= Math.cos(a) * seg;
    zz -= Math.sin(a) * seg;
  }
  parent.add(mag);
  return mag;
}

function straightMag(parent, { z, len, color, tilt = 0.1, w = 0.024, d = 0.045 }) {
  const mag = new THREE.Group();
  mag.position.set(0, -0.02, z);
  box(mag, [w, len, d], [0, -len / 2, -Math.sin(tilt) * len * 0.5], color, [-tilt, 0, 0]);
  parent.add(mag);
  return mag;
}

function rifle(o) {
  const root = new THREE.Group();
  const recBack = 0.09;
  const recFront = recBack - o.recLen;
  // 몸통(리시버)과 덮개
  box(root, [0.04, 0.055, o.recLen], [0, 0.005, (recBack + recFront) / 2], o.body ?? METAL);
  box(root, [0.036, 0.018, o.recLen * 0.9], [0, 0.04, (recBack + recFront) / 2 + 0.01], o.top ?? METAL_2);
  box(root, [0.042, 0.006, o.recLen * 0.5], [0, 0.0, (recBack + recFront) / 2], ACCENT);
  // 손잡이
  box(root, [0.03, 0.1, 0.04], [0, -0.06, 0.035], o.grip ?? POLYMER, [0.3, 0, 0]);
  // 방아쇠울
  box(root, [0.006, 0.006, 0.06], [0, -0.04, -0.015], METAL);
  // 총열 덮개(핸드가드)
  const hgBack = recFront;
  const hgFront = hgBack - o.hgLen;
  box(root, [0.044, o.hgH ?? 0.05, o.hgLen], [0, (o.hgY ?? 0.0), (hgBack + hgFront) / 2], o.furniture ?? POLYMER);
  // 총열
  const barrelEnd = hgFront - o.barrelOut;
  tube(root, o.barrelR ?? 0.009, hgFront, barrelEnd, [0, 0.012], METAL);
  let muzzleZ = barrelEnd;
  if (o.suppressor) {
    tube(root, 0.021, barrelEnd + 0.01, barrelEnd - o.suppressor, [0, 0.012], POLYMER, 16);
    muzzleZ = barrelEnd - o.suppressor;
  } else {
    tube(root, (o.barrelR ?? 0.009) * 1.5, barrelEnd + 0.03, barrelEnd, [0, 0.012], METAL_2);
  }
  // 가늠자/조준경
  if (o.scope) {
    tube(root, 0.018, recBack - 0.03, recBack - 0.03 - 0.14, [0, 0.075], METAL, 14);
    box(root, [0.012, 0.025, 0.02], [0, 0.055, recBack - 0.06], METAL);
    box(root, [0.012, 0.025, 0.02], [0, 0.055, recBack - 0.14], METAL);
  } else {
    box(root, [0.006, 0.025, 0.008], [0, 0.04, hgFront + 0.02], METAL);
    box(root, [0.02, 0.02, 0.012], [0, 0.058, recBack - 0.03], METAL);
  }
  // 개머리판
  if (o.stock === 'solid') {
    box(root, [0.038, 0.06, 0.17], [0, -0.012, recBack + 0.085], o.furniture ?? POLYMER, [0.1, 0, 0]);
    box(root, [0.04, 0.085, 0.02], [0, -0.025, recBack + 0.175], POLYMER, [0.1, 0, 0]);
  } else if (o.stock === 'skeleton') {
    box(root, [0.012, 0.012, 0.22], [0, 0.03, recBack + 0.11], METAL);
    box(root, [0.012, 0.012, 0.22], [0, -0.03, recBack + 0.11], METAL, [0.15, 0, 0]);
    box(root, [0.035, 0.08, 0.018], [0, -0.005, recBack + 0.22], POLYMER);
  }
  if (o.bipod) {
    box(root, [0.01, 0.01, 0.16], [0.015, -0.03, hgFront + 0.05], METAL);
    box(root, [0.01, 0.01, 0.16], [-0.015, -0.03, hgFront + 0.05], METAL);
  }
  // 탄창
  const magColor = o.magColor ?? POLYMER;
  let mag;
  if (o.mag === 'curved') mag = curvedMag(root, { z: -0.085, len: o.magLen, color: magColor });
  else if (o.mag === 'box') {
    mag = new THREE.Group();
    mag.position.set(0, -0.02, -0.09);
    box(mag, [0.07, 0.09, 0.09], [0.012, -0.045, 0], magColor);
    root.add(mag);
  } else if (o.mag === 'drum') {
    mag = new THREE.Group();
    mag.position.set(0, -0.02, -0.09);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.045, 20), mat(magColor));
    d.rotation.z = Math.PI / 2;
    d.position.set(0, -0.07, 0);
    mag.add(d);
    box(mag, [0.03, 0.04, 0.04], [0, -0.01, 0], magColor);
    root.add(mag);
  } else mag = straightMag(root, { z: -0.085, len: o.magLen, color: magColor, tilt: o.magTilt ?? 0.08 });

  hand(root, 'rightHand', [0.012, -0.06, 0.05], [0.55, 0.35]);
  hand(root, 'leftHand', [-0.012, -(o.hgH ?? 0.05) / 2 - 0.02, (hgBack + hgFront) / 2 + 0.02], [0.6, -0.45]);
  return { root, muzzle: muzzleAt(root, muzzleZ, 0.012), mag };
}

function pistol(o) {
  const root = new THREE.Group();
  const len = o.len ?? 0.19;
  // 슬라이드와 몸체
  box(root, [0.032, 0.034, len], [0, 0.03, -len / 2 + 0.04], o.slide ?? METAL_2);
  box(root, [0.03, 0.022, len * 0.85], [0, 0.003, -len * 0.85 / 2 + 0.035], POLYMER);
  box(root, [0.034, 0.005, len * 0.4], [0, 0.03, -len * 0.4], ACCENT);
  box(root, [0.006, 0.012, 0.006], [0, 0.052, -len + 0.05], METAL);
  // 손잡이(윗부분) + 탄창(아랫부분, 재장전 때 빠진다)
  box(root, [0.03, 0.06, 0.045], [0, -0.025, 0.02], POLYMER, [0.25, 0, 0]);
  const mag = new THREE.Group();
  mag.position.set(0, -0.055, 0.03);
  box(mag, [0.028, 0.05, 0.04], [0, -0.02, 0.005], o.magColor ?? POLYMER, [0.25, 0, 0]);
  root.add(mag);
  box(root, [0.006, 0.006, 0.04], [0, -0.012, -0.02], METAL);
  let muzzleZ = -len + 0.04;
  if (o.suppressor) {
    tube(root, 0.016, muzzleZ + 0.01, muzzleZ - o.suppressor, [0, 0.03], POLYMER, 14);
    muzzleZ -= o.suppressor;
  }
  if (o.extMag) box(mag, [0.026, 0.06, 0.036], [0, -0.07, 0.02], o.magColor ?? POLYMER, [0.25, 0, 0]);
  hand(root, 'rightHand', [0.002, -0.03, 0.03], [0.5, 0.3]);
  hand(root, 'leftHand', [-0.03, -0.045, 0.01], [0.55, -0.45]);
  return { root, muzzle: muzzleAt(root, muzzleZ, 0.03), mag };
}

function revolver() {
  const root = new THREE.Group();
  box(root, [0.032, 0.05, 0.1], [0, 0.015, -0.02], METAL);
  // 실린더(탄창 역할)
  const mag = new THREE.Group();
  mag.position.set(0, 0.015, -0.03);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.055, 6), mat(METAL_2, 0.4, 0.7));
  cyl.rotation.x = Math.PI / 2;
  mag.add(cyl);
  root.add(mag);
  tube(root, 0.011, -0.07, -0.25, [0, 0.03], METAL, 10);
  box(root, [0.014, 0.012, 0.18], [0, 0.012, -0.16], METAL_2);
  box(root, [0.034, 0.004, 0.08], [0, 0.044, -0.03], ACCENT);
  box(root, [0.005, 0.012, 0.006], [0, 0.045, -0.24], METAL);
  box(root, [0.008, 0.02, 0.012], [0, 0.045, 0.035], METAL);
  box(root, [0.032, 0.095, 0.045], [0, -0.05, 0.035], '#4a3a2c', [0.35, 0, 0]);
  box(root, [0.006, 0.006, 0.035], [0, -0.015, -0.01], METAL);
  hand(root, 'rightHand', [0.002, -0.04, 0.04], [0.5, 0.3]);
  hand(root, 'leftHand', [-0.03, -0.055, 0.02], [0.55, -0.45]);
  return { root, muzzle: muzzleAt(root, -0.25, 0.03), mag };
}

// 칼: 손잡이, 코등이, 칼날(앞쪽 -Z). 탄창 대신 빈 물체를 둔다.
function knife() {
  const root = new THREE.Group();
  box(root, [0.03, 0.035, 0.11], [0, 0, 0.03], POLYMER);
  box(root, [0.032, 0.008, 0.02], [0, 0.0, -0.005], ACCENT);
  box(root, [0.05, 0.02, 0.012], [0, 0, -0.03], METAL);
  const blade = new THREE.Group();
  blade.name = 'blade';
  box(blade, [0.006, 0.032, 0.16], [0, 0.002, -0.115], '#b8bec8');
  box(blade, [0.006, 0.02, 0.04], [0, -0.004, -0.21], '#b8bec8', [-0.35, 0, 0]);
  box(blade, [0.008, 0.006, 0.17], [0, 0.017, -0.11], METAL_2);
  root.add(blade);
  const mag = new THREE.Object3D();
  root.add(mag);
  hand(root, 'rightHand', [0.004, -0.004, 0.035], [0.5, 0.3]);
  return { root, muzzle: muzzleAt(root, -0.23, 0), mag };
}

const WOOD = '#7a5636';
const SAND = '#8e8066';
const GUNS = {
  classic: () => pistol({}),
  ghost: () => pistol({ suppressor: 0.14, slide: '#4a515c' }),
  sheriff: () => revolver(),
  frenzy: () => pistol({ len: 0.17, extMag: true, slide: '#3a3f47' }),
  stinger: () => rifle({ recLen: 0.2, hgLen: 0.09, barrelOut: 0.04, stock: 'skeleton', mag: 'straight', magLen: 0.15, magTilt: 0.02 }),
  spectre: () => rifle({ recLen: 0.22, hgLen: 0.1, barrelOut: 0.0, suppressor: 0.17, stock: 'skeleton', mag: 'straight', magLen: 0.17, body: '#30353d' }),
  bulldog: () => rifle({ recLen: 0.28, hgLen: 0.16, barrelOut: 0.08, stock: 'solid', mag: 'straight', magLen: 0.13, scope: true, furniture: SAND }),
  guardian: () => rifle({ recLen: 0.3, hgLen: 0.22, barrelOut: 0.22, stock: 'solid', mag: 'straight', magLen: 0.11, scope: true, furniture: '#4b5160', barrelR: 0.01 }),
  phantom: () => rifle({ recLen: 0.28, hgLen: 0.18, barrelOut: 0.02, suppressor: 0.2, stock: 'solid', mag: 'straight', magLen: 0.16, magTilt: 0.12 }),
  vandal: () => rifle({ recLen: 0.3, hgLen: 0.17, barrelOut: 0.17, stock: 'solid', mag: 'curved', magLen: 0.2, furniture: WOOD, magColor: '#2c2f34' }),
  ares: () => rifle({ recLen: 0.32, hgLen: 0.22, hgH: 0.065, barrelOut: 0.12, barrelR: 0.012, stock: 'solid', mag: 'box', bipod: true, furniture: '#353a43' }),
  knife: () => knife(),
  odin: () => rifle({ recLen: 0.34, hgLen: 0.24, hgH: 0.07, barrelOut: 0.14, barrelR: 0.014, stock: 'solid', mag: 'drum', bipod: true, furniture: '#2d3139', top: '#4a505a' }),
};

export function buildGun(id) {
  const g = (GUNS[id] ?? GUNS.vandal)();
  g.root.userData.role = 'gun';
  return g;
}

export function disposeGun(g) {
  g.root.traverse((o) => o.geometry?.dispose());
}
