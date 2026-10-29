import { test, expect } from 'vitest';
import { sampleSpread } from '../src/core/spread.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const angleDeg = (a, b) => (Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) * 180) / Math.PI;

test('sampleSpread within cone and uniform over the disk', () => {
  const dir = { x: 0.3, y: 0.2, z: -Math.sqrt(1 - 0.13) };
  const r = rng(7);
  let sumSq = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const d = sampleSpread(dir, 2, r);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
    const a = angleDeg(dir, d);
    expect(a).toBeLessThanOrEqual(2 + 1e-6);
    sumSq += a * a;
  }
  expect(sumSq / N).toBeGreaterThan(2 * 0.95);
  expect(sumSq / N).toBeLessThan(2 * 1.05);
});

test('zero spread returns the same direction', () => {
  const d = sampleSpread({ x: 0, y: 0, z: -1 }, 0, Math.random);
  expect(d).toEqual({ x: 0, y: 0, z: -1 });
});
