import { test, expect } from 'vitest';
import M from '../data/movement.json';
import { createPlayer, stepPlayer, speedFraction, eyeHeight } from '../src/core/physics.js';

const floor = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };
const idle = { wishX: 0, wishZ: 0, yaw: 0, walk: false, crouch: false, jump: false };
const hspeed = (p) => Math.hypot(p.vel.x, p.vel.z);

function run(p, input, seconds, boxes = [floor], mul = 1) {
  const dt = 1 / 165;
  for (let t = 0; t < seconds; t += dt) stepPlayer(p, input, boxes, dt, M, mul);
}

test('reaches run speed', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishZ: 1 }, 1);
  expect(hspeed(p)).toBeGreaterThan(M.runSpeed * 0.98);
  expect(hspeed(p)).toBeLessThan(M.runSpeed * 1.02);
});

test('weapon speed multiplier lowers top speed', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishZ: 1 }, 1, [floor], 0.8);
  expect(hspeed(p)).toBeCloseTo(M.runSpeed * 0.8, 1);
});

test('walk is slower', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishZ: 1, walk: true }, 1);
  expect(hspeed(p)).toBeGreaterThan(M.runSpeed * M.walkMul * 0.98);
  expect(hspeed(p)).toBeLessThan(M.runSpeed * M.walkMul * 1.02);
});

test('counter strafe stops fast', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishX: 1 }, 1);
  let t = 0;
  const dt = 1 / 165;
  while (speedFraction(p, M) >= 0.3 && t < 1) {
    stepPlayer(p, { ...idle, wishX: -1 }, [floor], dt, M, 1);
    t += dt;
  }
  expect(t).toBeLessThan(0.15);
});

test('forward follows yaw', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishZ: 1, yaw: Math.PI / 2 }, 0.5);
  expect(p.vel.x).toBeLessThan(-1);
  expect(Math.abs(p.vel.z)).toBeLessThan(0.01);
});

test('jump apex', () => {
  let top = 0;
  const dt = 1 / 240;
  const q = createPlayer({ x: 0, y: 0, z: 0 });
  stepPlayer(q, { ...idle, jump: true }, [floor], dt, M, 1);
  for (let t = 0; t < 1.2; t += dt) {
    stepPlayer(q, idle, [floor], dt, M, 1);
    top = Math.max(top, q.pos.y);
  }
  const expected = (M.jumpVelocity ** 2) / (2 * M.gravity);
  expect(top).toBeGreaterThan(expected * 0.97);
  expect(top).toBeLessThan(expected * 1.03);
  expect(q.onGround).toBe(true);
  expect(q.pos.y).toBeCloseTo(0, 3);
});

test('crouch lowers eye', () => {
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  expect(eyeHeight(p, M)).toBeCloseTo(M.eyeStand, 5);
  run(p, { ...idle, crouch: true }, M.crouchTransition + 0.05);
  expect(eyeHeight(p, M)).toBeCloseTo(M.eyeCrouch, 5);
});

test('large dt does not tunnel through wall', () => {
  const wall = { min: { x: -5, y: 0, z: -1.2 }, max: { x: 5, y: 3, z: -1 } };
  const p = createPlayer({ x: 0, y: 0, z: -0.45 });
  p.vel.z = -M.runSpeed;
  stepPlayer(p, { ...idle, wishZ: 1 }, [floor, wall], 0.5, M, 1);
  expect(p.pos.z).toBeGreaterThan(-1);
});

test('steps up small ledge but not a tall one', () => {
  const low = { min: { x: -5, y: 0, z: -3 }, max: { x: 5, y: 0.3, z: -1 } };
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  run(p, { ...idle, wishZ: 1 }, 0.5, [floor, low]);
  expect(p.pos.z).toBeLessThan(-1.5);
  expect(p.pos.y).toBeCloseTo(0.3, 2);

  const high = { min: { x: -5, y: 0, z: -3 }, max: { x: 5, y: 0.6, z: -1 } };
  const q = createPlayer({ x: 0, y: 0, z: 0 });
  run(q, { ...idle, wishZ: 1 }, 1, [floor, high]);
  expect(q.pos.y).toBeCloseTo(0, 2);
  expect(q.pos.z).toBeGreaterThan(-1 + 0.01 - M.radius - 0.02);
});
