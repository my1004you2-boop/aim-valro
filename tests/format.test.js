import { test, expect } from 'vitest';
import { pct, sec, deg, cm360Label, sessionFileName } from '../src/ui/format.js';

test('pct', () => {
  expect(pct(0.5)).toBe('50%');
  expect(pct(0.1234)).toBe('12%');
  expect(pct(null)).toBe('—');
});

test('sec', () => {
  expect(sec(0.4567)).toBe('0.457초');
  expect(sec(null)).toBe('—');
});

test('deg', () => {
  expect(deg(1.234)).toBe('1.23°');
  expect(deg(null)).toBe('—');
});

test('cm360Label uses dpi and sens', () => {
  expect(cm360Label(1600, 0.194)).toBe('한 바퀴 42.1cm');
});

test('sessionFileName is safe for windows', () => {
  expect(sessionFileName(new Date('2026-10-29T05:06:07.000Z'), 'peek')).toBe('2026-10-29T05-06-07-peek.json');
});
