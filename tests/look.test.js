import { test, expect } from 'vitest';
import { createLook } from '../src/game/look.js';

const deg = (r) => (r * 180) / Math.PI;

test('mouse right turns yaw negative by counts * 0.07 * sens', () => {
  const l = createLook({ sens: 0.194 });
  l.applyMouse(1000, 0, true);
  expect(deg(l.yaw)).toBeCloseTo(-13.58, 2);
});

test('pitch is clamped to 89 degrees', () => {
  const l = createLook({ sens: 0.194 });
  l.applyMouse(0, -100000, true);
  expect(deg(l.pitch)).toBeCloseTo(89, 3);
  l.applyMouse(0, 200000, true);
  expect(deg(l.pitch)).toBeCloseTo(-89, 3);
});

test('ignores mouse input when pointer is not locked', () => {
  const l = createLook({ sens: 0.194 });
  l.applyMouse(500, 300, false);
  expect(l.yaw).toBe(0);
  expect(l.pitch).toBe(0);
});

test('forward points to -Z at rest', () => {
  const f = createLook({ sens: 1 }).forward();
  expect(f.x).toBeCloseTo(0);
  expect(f.y).toBeCloseTo(0);
  expect(f.z).toBeCloseTo(-1);
});
