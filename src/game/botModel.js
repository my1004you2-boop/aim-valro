import * as THREE from 'three';

// 발로란트 요원과 비슷한 비율(커뮤니티 측정 기반 근사): 키 약 1.8m, 머리 중심 1.6m, 머리 폭 약 0.25m.
// 특정 요원을 따라 하지 않는 독자 디자인의 전술 요원이다.
export const BOT_DIMENSIONS = Object.freeze({
  height: 1.8,
  headCenter: 1.6,
  head: { w: 0.25, h: 0.28, d: 0.26 },
  shoulder: 0.5,
  hipStand: 0.92,
  hipCrouch: 0.56,
});

const RUN_SPEED = 6.75;
const MAX_LEAN = (6 * Math.PI) / 180;
const SPINE_TO_NECK = 0.55;
const NECK_TO_HEAD = BOT_DIMENSIONS.headCenter - BOT_DIMENSIONS.hipStand - 0.05 - SPINE_TO_NECK;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function hitbox(w, h, d, part, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ wireframe: true, color: '#ffff00' }));
  m.position.set(x, y, z);
  m.visible = false;
  m.userData.part = part;
  return m;
}

function capsule(r, len, mat, y) {
  return mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat, 0, y, 0);
}

export function createBotModel(colors) {
  const D = BOT_DIMENSIONS;
  const mats = {
    head: new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.6 }),
    body: new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.8 }),
    vest: new THREE.MeshStandardMaterial({ color: '#232832', roughness: 0.7 }),
    legs: new THREE.MeshStandardMaterial({ color: colors.legs, roughness: 0.85 }),
    gun: new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.5, metalness: 0.3 }),
    accent: new THREE.MeshStandardMaterial({ color: '#00c8d7', emissive: '#00646b', roughness: 0.4 }),
  };

  const root = new THREE.Group();
  const hips = new THREE.Group();
  root.add(hips);
  hips.add(mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), mats.legs));

  // 상체
  const spine = new THREE.Group();
  spine.position.y = 0.05;
  hips.add(spine);
  spine.add(mesh(new THREE.BoxGeometry(0.44, 0.5, 0.25), mats.body, 0, 0.27, 0));
  spine.add(mesh(new THREE.BoxGeometry(0.4, 0.34, 0.29), mats.vest, 0, 0.3, 0));
  spine.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.01), mats.accent, 0.1, 0.4, 0.146));

  // 목과 머리(헬멧/후드 없음: 머리 윤곽이 그대로 보인다)
  const neck = new THREE.Group();
  neck.position.y = SPINE_TO_NECK;
  spine.add(neck);
  neck.add(capsule(0.06, 0.05, mats.body, 0));
  const head = new THREE.Group();
  head.position.y = NECK_TO_HEAD;
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.5, 20, 16), mats.head);
  skull.scale.set(D.head.w, D.head.h, D.head.d);
  head.add(skull);
  head.add(mesh(new THREE.BoxGeometry(0.17, 0.035, 0.02), mats.accent, 0, 0.02, 0.125));

  // 팔과 총(가슴 앞에 든 자세)
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * (D.shoulder / 2), 0.47, 0);
    arm.rotation.order = 'YXZ';
    arm.rotation.x = -0.45;
    arm.rotation.y = side * -0.5;
    arm.rotation.z = side * -0.1;
    spine.add(arm);
    arm.add(capsule(0.055, 0.22, mats.body, -0.15));
    const fore = new THREE.Group();
    fore.position.y = -0.3;
    fore.rotation.x = -1.35;
    arm.add(fore);
    fore.add(capsule(0.05, 0.2, mats.body, -0.13));
  }
  const gun = new THREE.Group();
  gun.position.set(0.02, 0.3, 0.32);
  spine.add(gun);
  gun.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.62), mats.gun));
  gun.add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.06), mats.gun, 0, -0.1, 0.05));

  // 다리
  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.1, -0.05, 0);
    hips.add(thigh);
    thigh.add(capsule(0.075, 0.3, mats.legs, -0.22));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    thigh.add(knee);
    knee.add(capsule(0.065, 0.3, mats.legs, -0.21));
    knee.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), mats.vest, 0, -0.42, 0.04));
    thigh.add(hitbox(0.17, 0.46, 0.18, 'legs', 0, -0.22, 0));
    knee.add(hitbox(0.15, 0.48, 0.2, 'legs', 0, -0.22, 0.02));
    legs.push({ thigh, knee, side });
  }

  // 판정 상자
  const headHit = hitbox(D.head.w, D.head.h, D.head.d, 'head');
  head.add(headHit);
  spine.add(hitbox(0.5, 0.62, 0.3, 'body', 0, 0.22, 0));
  hips.add(hitbox(0.38, 0.22, 0.24, 'body', 0, -0.02, 0));
  const hitboxes = [];
  root.traverse((o) => o.userData.part && hitboxes.push(o));

  root.traverse((o) => {
    if (o.isMesh && !o.userData.part) o.castShadow = true;
  });

  function setPose({ strafeVel, crouch, t }) {
    const k = Math.min(1, Math.abs(strafeVel) / RUN_SPEED);
    hips.position.y = D.hipStand + (D.hipCrouch - D.hipStand) * crouch;
    spine.rotation.x = 0.25 * crouch;
    spine.rotation.z = -Math.sign(strafeVel) * MAX_LEAN * k;
    const phase = t * 11;
    for (const { thigh, knee, side } of legs) {
      thigh.rotation.x = -1.15 * crouch;
      knee.rotation.x = 2.0 * crouch;
      thigh.rotation.z = side * (0.04 + Math.max(0, Math.sin(phase + (side > 0 ? 0 : Math.PI))) * 0.32 * k);
    }
    root.updateMatrixWorld(true);
  }

  const tmp = new THREE.Vector3();
  setPose({ strafeVel: 0, crouch: 0, t: 0 });

  return {
    root,
    hitboxes,
    setPose,
    headWorldPos: () => head.getWorldPosition(tmp).clone(),
    setDebug(on) {
      hitboxes.forEach((h) => (h.visible = on));
    },
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}
