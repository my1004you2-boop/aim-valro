import { test, expect } from 'vitest';
import { pickCover } from '../src/core/spawn.js';
import { classifyBucket } from '../src/core/buckets.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const cfg = DEFAULT_SETTINGS.buckets;
const P = { x: 0, y: 0, z: 0 };
const covers = [];
[10, 20, 40].forEach((dist, d) => [-3, 0, 3].forEach((y, h) => covers.push({ id: `c${d}${h}`, hide: { x: h * 2, y, z: -dist } })));

test('pickCover balances the 3x3 cells', () => {
  const history = [];
  const r = rng(1);
  for (let i = 0; i < 90; i++) {
    const c = pickCover(covers, P, history, cfg, () => true, r);
    history.push({ ...classifyBucket(P, c.hide, cfg), coverId: c.id });
  }
  const counts = {};
  history.forEach((x) => (counts[`${x.d}${x.h}`] = (counts[`${x.d}${x.h}`] ?? 0) + 1));
  expect(Object.keys(counts)).toHaveLength(9);
  Object.values(counts).forEach((n) => expect(Math.abs(n - 10)).toBeLessThanOrEqual(1));
});

test('never picks an invisible cover or the one just used', () => {
  const r = rng(2);
  const visible = (c) => c.hide.y === 0;
  let last = null;
  for (let i = 0; i < 50; i++) {
    const history = last ? [{ ...classifyBucket(P, last.hide, cfg), coverId: last.id }] : [];
    const c = pickCover(covers, P, history, cfg, visible, r);
    expect(c.hide.y).toBe(0);
    if (last) expect(c.id).not.toBe(last.id);
    last = c;
  }
});

test('disabled cells are skipped', () => {
  const off = { ...cfg, enabled: { distance: [true, false, false], height: [true, true, true] } };
  for (let i = 0; i < 20; i++) {
    const c = pickCover(covers, P, [], off, () => true, rng(i + 3));
    expect(classifyBucket(P, c.hide, cfg).d).toBe(0);
  }
});
