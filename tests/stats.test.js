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

test('flick summary splits by flick size and counts over/undershoots', () => {
  const f = (deg, residual, head) => bot({ mode: 'flick', flickDeg: deg, flickResidual: residual, firstShot: head ? 'head' : 'body', shots: [shot(head ? 'head' : 'body')] });
  const s = summarize([f(10, 0.5, true), f(30, -1, false), f(60, -2, false), f(70, 1, true)], () => 1);
  expect(s.flick.bins.map((b) => b.n)).toEqual([1, 1, 2]);
  expect(s.flick.bins[0].firstShotHeadRate).toBe(1);
  expect(s.flick.bins[2].firstShotHeadRate).toBe(0.5);
  expect(s.flick.overshoot).toBe(2);
  expect(s.flick.undershoot).toBe(2);
  expect(summarize(bots, () => 1).flick).toBe(null);
});

test('clear summary counts waves, angles caught off guard and bots that had to be revealed', () => {
  const c = (wave, err, revealed = false) => bot({ mode: 'clear', wave, placementErr: err, revealed, shots: [shot('head')], firstShot: 'head' });
  const s = summarize([c(1, { v: 1, h: 2 }), c(1, { v: 5, h: 40 }), c(2, { v: 0, h: 3 }, true), c(2, { v: 20, h: 30 })], () => 1);
  expect(s.clear).toEqual({ waves: 2, offGuard: 2, revealed: 1 });
  expect(summarize(bots, () => 1).clear).toBe(null);
});

test('braking summary counts each kind of shot and voided shots', () => {
  const b = (kind, ms = null, voided = false) => shot('head', { brake: { kind, accurate: !['moving', 'overheld'].includes(kind), sinceStopMs: ms }, voided });
  const s = summarize([bot({ shots: [b('still'), b('braked', 80), b('braked', 120), b('coasted', 300), b('moving', null, true), b('overheld')] })], () => 1);
  expect(s.brake.counts).toEqual({ still: 1, braked: 2, coasted: 1, moving: 1, overheld: 1 });
  expect(s.brake.afterMoveAccurate).toBeCloseTo(3 / 5);
  expect(s.brake.voided).toBe(1);
});

test('braking summary splits tok braking (opposite key) from manse braking (letting go)', () => {
  const b = (kind, part, sinceStopMs, stopMs) => shot(part, { brake: { kind, accurate: true, sinceStopMs, stopMs } });
  const s = summarize([bot({ shots: [b('braked', 'head', 80, 60), b('braked', 'body', 120, 80), b('coasted', 'head', 300, 200)] })], () => 1);
  expect(s.brake.styles.braked).toEqual({ count: 2, avgStopMs: 70, avgShotMs: 100, headRate: 0.5 });
  expect(s.brake.styles.coasted).toEqual({ count: 1, avgStopMs: 200, avgShotMs: 300, headRate: 1 });
  const none = summarize([bot({ shots: [b('still', 'head', null, null)] })], () => 1);
  expect(none.brake.styles.braked).toEqual({ count: 0, avgStopMs: null, avgShotMs: null, headRate: null });
});

test('strafe summary averages reaction from the cue and counts misses', () => {
  const s = summarize([bot({ mode: 'strafe', cueAt: 1, reaction: 0.3 }), bot({ mode: 'strafe', cueAt: 2, reaction: 0.5 }), bot({ mode: 'strafe', cueAt: 3, failed: true, killedAt: null })], () => 1);
  expect(s.strafe.avgReaction).toBeCloseTo(0.4);
  expect(s.strafe.failed).toBe(1);
  expect(summarize(bots, () => 1).strafe).toBe(null);
});
