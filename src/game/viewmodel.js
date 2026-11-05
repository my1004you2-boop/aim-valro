import * as THREE from 'three';
import { buildGun, disposeGun } from './gunModels.js';

// 1인칭 총 화면: 별도 장면/카메라로 그려서 벽에 파묻히지 않는다.
const BASE = { x: 0.17, y: -0.165, z: -0.46, rx: 0.02, ry: 0.07, rz: -0.03 };
const EQUIP_TIME = 0.45;
const FLASH_TIME = 0.04;
const MAG_DROP = 0.3;
const SWING_TIME = 0.3;

/**
 * 총의 자세(카메라 기준). s = { sinceShot(초), reloadProgress(0..1|null), equip(0..1), bob(위상), speed(0..1), melee?, swayX?, swayY? }
 */
export function viewmodelPose(s) {
  const p = { ...BASE, magDrop: 0, magHidden: false, flash: !s.melee && s.sinceShot < FLASH_TIME };
  if (s.melee) {
    // 칼: 오른쪽 위에서 왼쪽 아래로 베는 호
    const t = s.sinceShot / SWING_TIME;
    const swing = t >= 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
    p.x -= 0.1 * swing;
    p.y += 0.02 * swing;
    p.z -= 0.06 * swing;
    p.ry += 0.6 * swing;
    p.rz += 0.9 * swing;
  } else {
    // 반동: 뒤로 밀리고 총구가 들린 뒤 빠르게 돌아온다.
    const k = Number.isFinite(s.sinceShot) ? Math.exp(-s.sinceShot * 22) : 0;
    p.z += 0.035 * k;
    p.y += 0.006 * k;
    p.rx += 0.09 * k;
  }
  // 재장전: 총을 내리고 기울인 채 탄창을 뺐다가 끼운다.
  if (s.reloadProgress !== null) {
    const r = s.reloadProgress;
    const env = Math.sin(Math.PI * r);
    p.y -= 0.07 * env;
    p.rx -= 0.25 * env;
    p.rz += 0.5 * env;
    if (r >= 0.15 && r < 0.35) p.magDrop = ((r - 0.15) / 0.2) * MAG_DROP;
    else if (r >= 0.35 && r < 0.6) p.magDrop = MAG_DROP;
    else if (r >= 0.6 && r < 0.8) p.magDrop = MAG_DROP * (1 - (r - 0.6) / 0.2);
    p.magHidden = p.magDrop >= MAG_DROP - 1e-6;
  }
  // 꺼내기: 아래에서 올라온다.
  const e = 1 - (1 - Math.min(1, Math.max(0, s.equip))) ** 3;
  p.y -= 0.25 * (1 - e);
  p.rx -= 0.6 * (1 - e);
  // 걸을 때 흔들림, 시점 돌릴 때 따라오는 지연
  p.x += Math.sin(s.bob) * 0.008 * s.speed + (s.swayX ?? 0);
  p.y -= Math.abs(Math.cos(s.bob)) * 0.006 * s.speed - (s.swayY ?? 0);
  return p;
}

function makeFlash() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: '#ffcf6b', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(0.07, 0.07);
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(geo, m);
    p.rotation.z = (i * Math.PI) / 4;
    g.add(p);
  }
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.12), m);
  side.rotation.y = Math.PI / 2;
  side.position.z = -0.04;
  g.add(side);
  g.visible = false;
  return g;
}

export function createViewmodel() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e3ebff', '#2b2f38', 1.4));
  const key = new THREE.DirectionalLight('#fff4e6', 1.6);
  key.position.set(0.6, 1, 0.4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.01, 10);
  const holder = new THREE.Group();
  scene.add(holder);

  let gun = null;
  let melee = false;
  let flash = null;
  let magBase = null;
  let equipStart = null;
  let bob = 0;
  const sway = { x: 0, y: 0 };

  function clear() {
    if (!gun) return;
    holder.remove(gun.root);
    disposeGun(gun);
    gun = null;
  }

  return {
    scene,
    camera,
    setWeapon(id) {
      clear();
      gun = buildGun(id);
      melee = id === 'knife';
      holder.add(gun.root);
      flash = makeFlash();
      gun.muzzle.add(flash);
      magBase = gun.mag.position.clone();
      equipStart = null;
      bob = 0;
    },
    setAspect(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    // s = { now, shotAt, reloadProgress, speed(0..1), dx, dy(이번 프레임 마우스 이동) }
    update(dt, s) {
      if (!gun) return;
      if (equipStart === null || s.now < equipStart) equipStart = s.now;
      bob += dt * s.speed * 11;
      const rate = (v) => v / Math.max(dt, 1e-3);
      const clamp = (v) => Math.max(-0.025, Math.min(0.025, v));
      const k = Math.min(1, dt * 10);
      sway.x += (clamp(-rate(s.dx) * 0.000008) - sway.x) * k;
      sway.y += (clamp(rate(s.dy) * 0.000008) - sway.y) * k;
      const p = viewmodelPose({
        sinceShot: s.now - s.shotAt,
        reloadProgress: s.reloadProgress,
        equip: (s.now - equipStart) / EQUIP_TIME,
        bob,
        speed: s.speed,
        melee,
        swayX: sway.x,
        swayY: sway.y,
      });
      holder.position.set(p.x, p.y, p.z);
      holder.rotation.set(p.rx, p.ry, p.rz);
      gun.mag.position.set(magBase.x, magBase.y - p.magDrop, magBase.z);
      gun.mag.visible = !p.magHidden;
      flash.visible = p.flash;
      if (p.flash) flash.rotation.z = Math.random() * Math.PI;
    },
    // 총구의 화면 좌표(-1..1). 총알 궤적 시작점을 맞추는 데 쓴다.
    muzzleNdc() {
      holder.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      const v = gun ? gun.muzzle.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(BASE.x, BASE.y, -0.8);
      v.project(camera);
      return { x: v.x, y: v.y };
    },
    dispose: clear,
  };
}
