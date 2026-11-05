import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
raycaster.far = 100;

// 가장 가까운 교차점의 부위를 돌려준다. 벽이 먼저 맞으면 part는 null이다.
export function castShot({ origin, dir, worldMeshes, botHitboxes }) {
  raycaster.set(origin, dir);
  const hit = raycaster.intersectObjects([...worldMeshes, ...botHitboxes], false)[0];
  if (!hit) return { part: null, point: null, normal: null, distance: Infinity, object: null };
  const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
  return { part: hit.object.userData.part ?? null, point: hit.point, normal, distance: hit.distance, object: hit.object };
}

// 근접 공격: range(m) 안에서 맞은 것만 인정한다.
export function castMelee({ origin, dir, range, worldMeshes, botHitboxes }) {
  const r = castShot({ origin, dir, worldMeshes, botHitboxes });
  return r.distance <= range ? r : { part: null, point: null, normal: null, distance: Infinity, object: null };
}

export function aimedPart(origin, aimDir, botHitboxes, worldMeshes) {
  return castShot({ origin, dir: aimDir, worldMeshes, botHitboxes }).part;
}
