import { test, expect } from 'vitest';
import { summarize } from '../src/core/stats.js';

const shot = (part, extra = {}) => ({ t: 0, weapon: 'vandal', part, aimedPart: part, moving: false, distM: 10, d: 0, h: 1, damage: 0, ...extra });
const bot = (o) => ({ mode: 'peek', coverId: 'c', d: 0, h: 1, kind: 'short', peekIndex: 1, firstSeenAt: 0, killedAt: 1, placementErr: null, distM: 10, shots: [], firstShot: null, failed: false, ...o });

const bots = [
  bot({ shots: [shot('head')], firstShot: 'head', killedAt: 0.5, placementErr: { v: 1, h: 2 } }),
  bot({ d: 2, h: 0, kind: 'wide', shots: [shot('body'), shot(null, { aimedPart: 'head' }), shot('head')], firstShot: 'body', killedAt: 1.5, placementErr: { v: -3, h: 0 } }),
  bot({ d: 2, h: 0, kind: 'wide', shots: [shot('legs', { moving: true }), shot('head')], firstShot: 'legs', killedAt: 2.0 }),
  bot({ shots: [shot('head')], firstShot: 'head', killedAt: 0.3 }),
];

test('summary rates', () => {
  const s = summarize(bots, () => 1);
  expect(s.firstShotHeadRate).toBeCloseTo(0.5);
  expect(s.headRate).toBeCloseTo(4 / 7);
  expect(s.bodyRate).toBeCloseTo(1 / 7);
  expect(s.legsRate).toBeCloseTo(1 / 7);
  expect(s.avgKillTime).toBeCloseTo((0.5 + 1.5 + 2 + 0.3) / 4);
  expect(s.avgPlacement).toEqual({ v: 2, h: 1 });
  expect(s.spreadMisses).toBe(1);
  expect(s.movingShots).toBe(1);
  expect(s.oneTapRate).toBeCloseTo(0.5);
});

test('grid and weakest cell', () => {
  const s = summarize(bots, () => 1);
  expect(s.grid[0][1].n).toBe(2);
  expect(s.grid[0][1].headRate).toBe(1);
  expect(s.grid[2][0].n).toBe(2);
  expect(s.grid[2][0].headRate).toBeCloseTo(2 / 5);
  expect(s.grid[1][1].n).toBe(0);
  expect(s.weakest).toEqual({ d: 2, h: 0 });
});

test('peek split and placement in head widths', () => {
  const s = summarize(bots, (dist) => (dist === 10 ? 0.5 : 1));
  expect(s.peekSplit.short.headRate).toBe(1);
  expect(s.peekSplit.wide.avgKillTime).toBeCloseTo(1.75);
  expect(s.avgPlacementHeads).toEqual({ v: 4, h: 2 });
});

test('empty session does not crash', () => {
  const s = summarize([], () => 1);
  expect(s.firstShotHeadRate).toBe(0);
  expect(s.avgKillTime).toBe(null);
  expect(s.weakest).toBe(null);
});
