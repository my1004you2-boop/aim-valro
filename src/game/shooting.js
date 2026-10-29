import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
raycaster.far = 100;

// 가장 가까운 교차점의 부위를 돌려준다. 벽이 먼저 맞으면 part는 null이다.
export function castShot({ origin, dir, worldMeshes, botHitboxes }) {
  raycaster.set(origin, dir);
  const hit = raycaster.intersectObjects([...worldMeshes, ...botHitboxes], false)[0];
  if (!hit) return { part: null, point: null, distance: Infinity };
  return { part: hit.object.userData.part ?? null, point: hit.point, distance: hit.distance };
}

export function aimedPart(origin, aimDir, botHitboxes, worldMeshes) {
  return castShot({ origin, dir: aimDir, worldMeshes, botHitboxes }).part;
}
