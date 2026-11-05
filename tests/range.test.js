import { test, expect } from 'vitest';
import range from '../data/range.json';
import { classifyBucket } from '../src/core/buckets.js';
import { coversFor } from '../src/core/covers.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

const BOT_R = 0.3;
// 장식(창문, 처마)은 충돌하지 않는다.
const solid = range.boxes.filter((b) => !b.deco);
const inside = (p, b) => p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z;
// 맵 곳곳의 플레이어 위치: 시작점, 큰길 끝, 수로 골목, 테라스, 수로 앞쪽
const SPOTS = [range.spawn, { x: 0, y: 0, z: -46 }, { x: -11, y: -1.8, z: -41 }, { x: 11, y: 1.8, z: -40 }, { x: -10, y: -1.8, z: -10 }];
const pathPoints = (c) => [0, c.shortDist, c.wideDist].map((dist) => ({ x: c.hide.x + c.dirs[0].x * dist, z: c.hide.z + c.dirs[0].z * dist, dist }));

test('the map lists cover walls', () => {
  expect(range.walls.length).toBeGreaterThanOrEqual(18);
});

test('every cover stands on a surface and its peek path stays on it', () => {
  for (const feet of SPOTS) {
    for (const c of coversFor(range.walls, solid, feet)) {
      for (const p of pathPoints(c)) {
        const under = solid.filter((b) => inside(p, b) && Math.abs(b.max.y - c.hide.y) < 0.1);
        expect(under.length, `${c.id} @${p.dist}`).toBeGreaterThan(0);
      }
    }
  }
});

test('hide spot and peek path are not inside any box', () => {
  for (const feet of SPOTS) {
    for (const c of coversFor(range.walls, solid, feet)) {
      for (const p of pathPoints(c)) {
        const hit = solid.find(
          (b) => b.max.y > c.hide.y + 0.05 && b.min.y < c.hide.y + 1.8 &&
            p.x + BOT_R > b.min.x && p.x - BOT_R < b.max.x && p.z + BOT_R > b.min.z && p.z - BOT_R < b.max.z,
        );
        expect(hit, `${c.id} @${p.dist}`).toBeUndefined();
      }
    }
  }
});

test('the hide spot is always on the far side of the wall from the player', () => {
  for (const feet of SPOTS) {
    for (const c of coversFor(range.walls, solid, feet)) {
      const w = range.walls.find((x) => x.id === c.wall);
      const n = w.hx >= w.hz ? { x: 0, z: 1 } : { x: 1, z: 0 };
      const hideSide = (c.hide.x - w.x) * n.x + (c.hide.z - w.z) * n.z;
      const playerSide = (feet.x - w.x) * n.x + (feet.z - w.z) * n.z;
      expect(Math.sign(hideSide), c.id).toBe(playerSide >= 0 ? -1 : 1);
    }
  }
});

test('3x3 buckets each have at least 2 covers from spawn', () => {
  const counts = {};
  for (const c of coversFor(range.walls, solid, range.spawn)) {
    const b = classifyBucket(range.spawn, c.hide, DEFAULT_SETTINGS.buckets);
    counts[`${b.d}${b.h}`] = (counts[`${b.d}${b.h}`] ?? 0) + 1;
  }
  for (const d of [0, 1, 2]) for (const h of [0, 1, 2]) expect(counts[`${d}${h}`] ?? 0, `${d}${h}`).toBeGreaterThanOrEqual(2);
});

// 계단: 높이가 다른 바닥끼리 0.45m 이하 턱으로 이어지는 길이 여러 개 있어야 한다.
test('there are several stairways between the pit, the middle lane and the platform', () => {
  const steps = solid.filter((b) => b.flight);
  const flights = new Set(steps.map((b) => b.flight));
  expect(flights.size).toBeGreaterThanOrEqual(5);
  for (const f of flights) {
    const tops = steps.filter((b) => b.flight === f).map((b) => b.max.y).sort((a, b) => a - b);
    for (let i = 1; i < tops.length; i++) expect(tops[i] - tops[i - 1], f).toBeLessThanOrEqual(0.45);
  }
});
