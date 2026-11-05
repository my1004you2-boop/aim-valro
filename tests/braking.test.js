import { test, expect } from 'vitest';
import { createBrakeTracker, stepBrake, classifyShot } from '../src/core/braking.js';

const M = { runSpeed: 6.75, accurateSpeedFraction: 0.3 };
const dt = 1 / 120;

// 구간마다 [초, 속도 x, 누른 방향 x]로 x축 이동을 흉내 낸다. 속도는 구간 안에서 선형으로 바뀐다.
function run(segments) {
  const t = createBrakeTracker();
  let now = 0;
  let v = 0;
  for (const [secs, to, wish] of segments) {
    const from = v;
    const n = Math.round(secs / dt);
    for (let i = 1; i <= n; i++) {
      v = from + ((to - from) * i) / n;
      now += dt;
      stepBrake(t, { vel: { x: v, z: 0 }, wish: { x: wish, z: 0 }, now }, M);
    }
  }
  return { t, now };
}

test('standing still is a still shot', () => {
  const { t, now } = run([[1, 0, 0]]);
  expect(classifyShot(t, now, M)).toMatchObject({ kind: 'still', accurate: true });
});

test('shooting at full speed is a moving shot', () => {
  const { t, now } = run([[0.5, 6, 1]]);
  const s = classifyShot(t, now, M);
  expect(s).toMatchObject({ kind: 'moving', accurate: false });
  expect(s.speed).toBeCloseTo(6 / 6.75, 2);
});

test('letting go and sliding to a stop is a coasted shot', () => {
  const { t, now } = run([[0.5, 6, 1], [0.3, 0, 0], [0.1, 0, 0]]);
  const s = classifyShot(t, now, M);
  expect(s.kind).toBe('coasted');
  expect(s.sinceStopMs).toBeGreaterThan(100);
  expect(s.sinceStopMs).toBeLessThan(220);
});

test('tapping the opposite key to stop is a braked shot', () => {
  const { t, now } = run([[0.5, 6, 1], [0.1, 0, -1], [0.05, 0, 0]]);
  const s = classifyShot(t, now, M);
  expect(s).toMatchObject({ kind: 'braked', accurate: true });
  expect(s.sinceStopMs).toBeLessThan(100);
});

test('holding the opposite key too long and sliding back is an overheld shot', () => {
  const { t, now } = run([[0.5, 6, 1], [0.1, 0, -1], [0.2, -3, -1]]);
  expect(classifyShot(t, now, M)).toMatchObject({ kind: 'overheld', accurate: false });
});

test('a stop long ago counts as still again', () => {
  const { t, now } = run([[0.5, 6, 1], [0.1, 0, -1], [1.5, 0, 0]]);
  expect(classifyShot(t, now, M).kind).toBe('still');
});

test('the stop time is measured from letting go or pressing the opposite key', () => {
  const tok = classifyShot(...Object.values(run([[0.5, 6, 1], [0.1, 0, -1], [0.05, 0, 0]])), M);
  const manse = classifyShot(...Object.values(run([[0.5, 6, 1], [0.3, 0, 0], [0.1, 0, 0]])), M);
  expect(tok.stopMs).toBeGreaterThan(40);
  expect(tok.stopMs).toBeLessThan(100);
  expect(manse.stopMs).toBeGreaterThan(150);
  expect(manse.stopMs).toBeLessThan(250);
});

test('still and moving shots have no stop time', () => {
  const { t, now } = run([[1, 0, 0]]);
  expect(classifyShot(t, now, M).stopMs).toBe(null);
  const m = run([[0.5, 6, 1]]);
  expect(classifyShot(m.t, m.now, M).stopMs).toBe(null);
});
