import { test, expect } from 'vitest';
import { damageAt, applyDamage } from '../src/core/damage.js';
import data from '../data/weapons.json';

const w = {
  damage: [
    { maxRange: 15, head: 156, body: 39, legs: 33 },
    { maxRange: 30, head: 140, body: 35, legs: 29 },
    { maxRange: 999, head: 124, body: 31, legs: 26 },
  ],
};

test('damage falloff by range band', () => {
  expect(damageAt(w, 'head', 10)).toBe(156);
  expect(damageAt(w, 'head', 15)).toBe(156);
  expect(damageAt(w, 'head', 20)).toBe(140);
  expect(damageAt(w, 'head', 40)).toBe(124);
  expect(damageAt(w, 'legs', 40)).toBe(26);
});

test('armor absorbs fully when absorb is 1', () => {
  const rules = { absorb: 1 };
  let t = applyDamage({ hp: 100, armor: 50 }, 40, rules);
  expect(t).toEqual({ hp: 100, armor: 10, killed: false });
  t = applyDamage(t, 40, rules);
  expect(t).toEqual({ hp: 70, armor: 0, killed: false });
});

test('armor absorbs a fraction', () => {
  const t = applyDamage({ hp: 100, armor: 50 }, 30, { absorb: 0.66 });
  expect(t.armor).toBeCloseTo(50 - 19.8, 5);
  expect(t.hp).toBeCloseTo(100 - 10.2, 5);
});

test('kill when hp reaches zero', () => {
  expect(applyDamage({ hp: 30, armor: 0 }, 40, { absorb: 1 }).killed).toBe(true);
});

test('vandal: 4 body shots kill through heavy armor, 1 head shot kills', () => {
  const v = data.weapons.vandal;
  let t = { hp: 100, armor: 50 };
  for (let i = 0; i < 3; i++) t = applyDamage(t, damageAt(v, 'body', 10), { absorb: 1 });
  expect(t.killed).toBe(false);
  expect(applyDamage(t, damageAt(v, 'body', 10), { absorb: 1 }).killed).toBe(true);
  expect(applyDamage({ hp: 100, armor: 50 }, damageAt(v, 'head', 45), { absorb: 1 }).killed).toBe(true);
});
