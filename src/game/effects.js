import * as THREE from 'three';

// 사격 효과: 총알 궤적(날아가는 빛줄기), 벽 탄흔, 명중 불꽃. now는 세션 시계(초)다.
export const MAX_IMPACTS = 40;
const TRACER_SPEED = 260; // m/s
const TRACER_LENGTH = 2.2;
const TRACER_RADIUS = 0.01;
const IMPACT_LIFE = 6;
const IMPACT_FADE = 1.5;
const SPARK_LIFE = 0.09;
const SPARK_COLORS = { head: '#ffffff', body: '#ffd27a', legs: '#ffd27a', wall: '#d8d2c4' };

const UP = new THREE.Vector3(0, 1, 0);
// 기둥(높이 1)을 y=0..1에 두어 끝점에서부터 늘어나게 한다.
const tracerGeo = new THREE.CylinderGeometry(TRACER_RADIUS, TRACER_RADIUS, 1, 6, 1, true).translate(0, 0.5, 0);
const impactGeo = new THREE.CircleGeometry(0.03, 12);
const sparkGeo = new THREE.SphereGeometry(0.035, 8, 6);

export function createEffects(scene, settings) {
  let tracers = [];
  let impacts = [];
  let sparks = [];

  function add(geo, mat, role) {
    const m = new THREE.Mesh(geo, mat);
    m.userData.role = role;
    m.renderOrder = 2;
    scene.add(m);
    return m;
  }
  function remove(m) {
    scene.remove(m);
    m.material.dispose();
  }

  return {
    tracer(from, to, now) {
      if (!settings.effects.tracers) return;
      const dir = to.clone().sub(from);
      const total = dir.length();
      if (total < 0.5) return;
      dir.divideScalar(total);
      const mesh = add(
        tracerGeo,
        new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
        'tracer',
      );
      mesh.quaternion.setFromUnitVectors(UP, dir);
      mesh.visible = false;
      tracers.push({ mesh, from: from.clone(), dir, total, t0: now });
    },

    impact(point, normal, now) {
      if (!settings.effects.impacts || !normal) return;
      const mesh = add(
        impactGeo,
        new THREE.MeshBasicMaterial({ color: '#15171c', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
        'impact',
      );
      mesh.position.copy(point).addScaledVector(normal, 0.003);
      mesh.lookAt(point.clone().add(normal));
      impacts.push({ mesh, t0: now });
      while (impacts.length > MAX_IMPACTS) remove(impacts.shift().mesh);
    },

    spark(point, kind, now) {
      if (!settings.effects.impacts) return;
      const mesh = add(
        sparkGeo,
        new THREE.MeshBasicMaterial({ color: SPARK_COLORS[kind] ?? SPARK_COLORS.wall, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        'spark',
      );
      mesh.position.copy(point);
      sparks.push({ mesh, t0: now });
    },

    update(now) {
      tracers = tracers.filter((t) => {
        const head = Math.min(t.total, (now - t.t0) * TRACER_SPEED);
        const tail = Math.max(0, head - TRACER_LENGTH);
        if (tail >= t.total - 1e-6 || now - t.t0 > t.total / TRACER_SPEED + 0.05) {
          remove(t.mesh);
          return false;
        }
        t.mesh.visible = head - tail > 0.01;
        t.mesh.position.copy(t.from).addScaledVector(t.dir, tail);
        t.mesh.scale.set(1, Math.max(0.01, head - tail), 1);
        return true;
      });
      impacts = impacts.filter((i) => {
        const age = now - i.t0;
        if (age >= IMPACT_LIFE) {
          remove(i.mesh);
          return false;
        }
        i.mesh.material.opacity = 0.85 * Math.min(1, (IMPACT_LIFE - age) / IMPACT_FADE);
        return true;
      });
      sparks = sparks.filter((s) => {
        const k = (now - s.t0) / SPARK_LIFE;
        if (k >= 1) {
          remove(s.mesh);
          return false;
        }
        s.mesh.material.opacity = 1 - k;
        s.mesh.scale.setScalar(1 + k * 1.5);
        return true;
      });
    },

    clear() {
      for (const e of [...tracers, ...impacts, ...sparks]) remove(e.mesh);
      tracers = [];
      impacts = [];
      sparks = [];
    },
  };
}
