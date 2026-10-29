import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DEFAULT_COLOR = '#4b5262';

// range.json의 박스를 색별로 합쳐 그리기 호출을 줄인다. 충돌용 AABB 목록도 돌려준다.
export function buildWorld(scene, rangeData) {
  const byColor = new Map();
  const edges = [];
  const boxes = [];
  for (const b of rangeData.boxes) {
    const size = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    const g = new THREE.BoxGeometry(...size);
    g.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    const color = b.color ?? DEFAULT_COLOR;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(g);
    edges.push(new THREE.EdgesGeometry(g));
    boxes.push({ min: { ...b.min }, max: { ...b.max } });
  }

  const meshes = [];
  for (const [color, geos] of byColor) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    mesh.userData.world = true;
    scene.add(mesh);
    meshes.push(mesh);
    geos.forEach((g) => g.dispose());
  }
  const lines = new THREE.LineSegments(
    mergeGeometries(edges),
    new THREE.LineBasicMaterial({ color: '#0d0f13', transparent: true, opacity: 0.6 }),
  );
  scene.add(lines);
  edges.forEach((g) => g.dispose());

  return { boxes, meshes };
}
