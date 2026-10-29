import { test, expect } from 'vitest';
import { createWeaponState, tryFire, updateWeapon, startReload, currentSpreadDeg } from '../src/core/weapon.js';

const base = {
  auto: true, fireRate: 10, magazine: 30, reloadTime: 2,
  spread: { stand: 0.25, crouch: 0.2, walk: 3, run: 6, air: 9 },
  firingError: { perShot: 0.4, max: 3, recovery: 0.4 },
  recoil: { pitchPerShot: 0.6, yawJitter: 0.2, recoverRate: 6 },
};

function hold(s, w, from, to, step = 0.01) {
  let shots = 0;
  for (let t = from; t <= to + 1e-9; t += step) {
    updateWeapon(s, w, t);
    if (tryFire(s, w, t, true, false)) shots++;
  }
  return shots;
}

test('fire rate limits shots', () => {
  const s = createWeaponState(base);
  expect(tryFire(s, base, 0, true, true)).toBe(true);
  expect(tryFire(s, base, 0.05, true, false)).toBe(false);
  expect(tryFire(s, base, 0.1, true, false)).toBe(true);
});

test('semi auto needs re-press', () => {
  const w = { ...base, auto: false };
  const s = createWeaponState(w);
  expect(tryFire(s, w, 0, true, true)).toBe(true);
  expect(tryFire(s, w, 0.5, true, false)).toBe(false);
  expect(tryFire(s, w, 0.6, true, true)).toBe(true);
});

test('magazine empties then auto reload blocks firing', () => {
  const w = { ...base, magazine: 2 };
  const s = createWeaponState(w);
  expect(tryFire(s, w, 0, true, true)).toBe(true);
  expect(tryFire(s, w, 0.2, true, false)).toBe(true);
  expect(s.ammo).toBe(0);
  expect(s.reloadingUntil).toBeCloseTo(0.2 + 2, 6);
  updateWeapon(s, w, 1.0);
  expect(tryFire(s, w, 1.0, true, true)).toBe(false);
  updateWeapon(s, w, 2.21);
  expect(s.ammo).toBe(2);
});

test('holding trigger through reload resumes auto fire', () => {
  const w = { ...base, magazine: 3 };
  const s = createWeaponState(w);
  const shots = hold(s, w, 0, 2.6);
  expect(shots).toBeGreaterThanOrEqual(4);
});

test('manual reload refills and ignores full magazine', () => {
  const s = createWeaponState(base);
  startReload(s, base, 0);
  expect(s.reloadingUntil).toBe(null);
  tryFire(s, base, 0, true, true);
  startReload(s, base, 0.1);
  expect(s.reloadingUntil).toBeCloseTo(2.1, 6);
  updateWeapon(s, base, 2.2);
  expect(s.ammo).toBe(30);
});

test('firing error grows and recovers', () => {
  const s = createWeaponState(base);
  hold(s, base, 0, 0.4);
  expect(currentSpreadDeg(s, base, 'stand', 0.41)).toBeGreaterThan(base.spread.stand + 1);
  updateWeapon(s, base, 0.41 + base.firingError.recovery);
  expect(currentSpreadDeg(s, base, 'stand', 0.41 + base.firingError.recovery)).toBeCloseTo(base.spread.stand, 5);
});

test('stance spread', () => {
  const s = createWeaponState(base);
  expect(currentSpreadDeg(s, base, 'run', 0)).toBe(6);
  expect(currentSpreadDeg(s, base, 'crouch', 0)).toBe(0.2);
  expect(currentSpreadDeg(s, base, 'air', 0)).toBe(9);
});

test('each shot reports recoil', () => {
  const s = createWeaponState(base);
  tryFire(s, base, 0, true, true);
  expect(s.lastRecoil.pitch).toBeCloseTo(0.6, 6);
  expect(Math.abs(s.lastRecoil.yaw)).toBeLessThanOrEqual(0.2);
});
