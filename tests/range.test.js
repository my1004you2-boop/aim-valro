import { test, expect } from 'vitest';
import range from '../data/range.json';
import { classifyBucket } from '../src/core/buckets.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

const BOT_R = 0.3;
const inside = (p, b) => p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z;

test('every cover stands on a surface', () => {
  for (const c of range.covers) {
    const under = range.boxes.filter((b) => inside(c.hide, b) && Math.abs(b.max.y - c.hide.y) < 0.1);
    expect(under.length, c.id).toBeGreaterThan(0);
  }
});

test('peek path stays on a surface at the cover height', () => {
  for (const c of range.covers) {
    for (const dist of [0, c.shortDist, c.wideDist]) {
      const p = { x: c.hide.x + c.dirs[0].x * dist, z: c.hide.z + c.dirs[0].z * dist };
      const under = range.boxes.filter((b) => inside(p, b) && Math.abs(b.max.y - c.hide.y) < 0.1);
      expect(under.length, `${c.id} @${dist}`).toBeGreaterThan(0);
    }
  }
});

test('hide spot and peek path are not inside any box', () => {
  for (const c of range.covers) {
    for (const dist of [0, c.shortDist, c.wideDist]) {
      const p = { x: c.hide.x + c.dirs[0].x * dist, z: c.hide.z + c.dirs[0].z * dist };
      const hit = range.boxes.find(
        (b) => b.max.y > c.hide.y + 0.05 && b.min.y < c.hide.y + 1.8 &&
          p.x + BOT_R > b.min.x && p.x - BOT_R < b.max.x && p.z + BOT_R > b.min.z && p.z - BOT_R < b.max.z,
      );
      expect(hit, `${c.id} @${dist}`).toBeUndefined();
    }
  }
});

test('3x3 buckets each have at least 2 covers from spawn', () => {
  const counts = {};
  for (const c of range.covers) {
    const b = classifyBucket(range.spawn, c.hide, DEFAULT_SETTINGS.buckets);
    counts[`${b.d}${b.h}`] = (counts[`${b.d}${b.h}`] ?? 0) + 1;
  }
  for (const d of [0, 1, 2]) for (const h of [0, 1, 2]) expect(counts[`${d}${h}`] ?? 0, `${d}${h}`).toBeGreaterThanOrEqual(2);
});
