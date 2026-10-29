import { test, expect } from 'vitest';
import M from '../data/movement.json';
import { createPeekBot, stepPeekBot, botWorldPos } from '../src/core/peek.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const cfg = { wideRatio: 0.5, exposedTime: [0.25, 0.9], hiddenTime: [0.3, 1.2] };
const cover = (dirs = [{ x: 1, z: 0 }]) => ({ id: 't', hide: { x: 0, y: 0, z: -10 }, dirs, shortDist: 0.6, wideDist: 2.2 });
const DT = 1 / 120;

function simulate(b, seconds, onStep) {
  for (let t = 0; t < seconds; t += DT) {
    stepPeekBot(b, DT);
    onStep?.(b);
  }
}

test('cycles until killed in the right order', () => {
  const b = createPeekBot(cover(), cfg, M, rng(1));
  const order = ['hidden', 'out', 'exposed', 'in'];
  let prev = b.state;
  simulate(b, 30, (x) => {
    if (x.state !== prev) {
      expect(x.state).toBe(order[(order.indexOf(prev) + 1) % 4]);
      prev = x.state;
    }
  });
  expect(b.peekCount).toBeGreaterThanOrEqual(10);
});

test('short and wide peek distances', () => {
  const b = createPeekBot(cover(), cfg, M, rng(2));
  const maxByPeek = new Map();
  simulate(b, 40, (x) => {
    const key = `${x.peekCount}:${x.kind}`;
    maxByPeek.set(key, Math.max(maxByPeek.get(key) ?? 0, Math.abs(x.offset)));
  });
  let short = 0;
  let wide = 0;
  for (const [key, max] of maxByPeek) {
    if (key.startsWith('0:')) continue;
    if (key.endsWith('short')) {
      short++;
      expect(Math.abs(max - 0.6)).toBeLessThan(0.05);
    } else {
      wide++;
      expect(Math.abs(max - 2.2)).toBeLessThan(0.05);
    }
  }
  expect(short).toBeGreaterThan(0);
  expect(wide).toBeGreaterThan(0);
});

test('wide ratio', () => {
  const b = createPeekBot(cover(), cfg, M, rng(3));
  const kinds = [];
  let last = 0;
  while (kinds.length < 1000) {
    stepPeekBot(b, 1 / 30);
    if (b.peekCount !== last) {
      last = b.peekCount;
      kinds.push(b.kind);
    }
  }
  const wide = kinds.filter((k) => k === 'wide').length / kinds.length;
  expect(wide).toBeGreaterThan(0.4);
  expect(wide).toBeLessThan(0.6);
});

test('both directions are used when a cover has two', () => {
  const b = createPeekBot(cover([{ x: 1, z: 0 }, { x: -1, z: 0 }]), cfg, M, rng(4));
  const seen = new Set();
  simulate(b, 30, (x) => x.state === 'exposed' && seen.add(x.dirIndex));
  expect(seen).toEqual(new Set([0, 1]));
});

test('moves no faster than the player run speed', () => {
  const b = createPeekBot(cover(), cfg, M, rng(5));
  let max = 0;
  simulate(b, 20, (x) => (max = Math.max(max, Math.abs(x.vel))));
  expect(max).toBeLessThanOrEqual(M.runSpeed + 1e-9);
  expect(max).toBeGreaterThan(3);
});

test('botWorldPos follows the peek direction', () => {
  const c = cover();
  const b = createPeekBot(c, cfg, M, rng(6));
  b.offset = 1.5;
  expect(botWorldPos(b, c)).toEqual({ x: 1.5, y: 0, z: -10 });
});
