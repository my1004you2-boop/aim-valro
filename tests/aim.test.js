import { test, expect } from 'vitest';
import M from '../data/movement.json';
import { angleOffsets, stanceOf, headSizeDeg } from '../src/core/aim.js';

const dir = (yawDeg, pitchDeg) => {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  return { x: -Math.sin(y) * Math.cos(p), y: Math.sin(p), z: -Math.cos(y) * Math.cos(p) };
};

test('angleOffsets: target above and to the left', () => {
  const o = angleOffsets(dir(0, 0), dir(5, 2));
  expect(o.v).toBeCloseTo(2, 6);
  expect(o.h).toBeCloseTo(5, 6);
});

test('angleOffsets wraps yaw across ±180', () => {
  expect(angleOffsets(dir(179, 0), dir(-179, 0)).h).toBeCloseTo(2, 6);
});

test('stanceOf picks air, run, walk, crouch, stand', () => {
  const p = (speed, onGround = true, crouchT = 0) => ({ vel: { x: speed, y: 0, z: 0 }, onGround, crouchT });
  expect(stanceOf(p(0, false), M)).toBe('air');
  expect(stanceOf(p(M.runSpeed * 0.8), M)).toBe('run');
  expect(stanceOf(p(M.runSpeed * 0.45), M)).toBe('walk');
  expect(stanceOf(p(M.runSpeed * 0.2, true, 1), M)).toBe('crouch');
  expect(stanceOf(p(M.runSpeed * 0.27), M)).toBe('stand');
  // 데드존: 최고 속도의 27.5%까지
  expect(M.accurateSpeedFraction).toBe(0.275);
  expect(stanceOf(p(M.runSpeed * 0.285), M)).toBe('walk');
});

test('headSizeDeg is the angular width of a 0.25 m head', () => {
  expect(headSizeDeg(10)).toBeCloseTo(1.432, 2);
  expect(headSizeDeg(40)).toBeCloseTo(0.358, 2);
});
