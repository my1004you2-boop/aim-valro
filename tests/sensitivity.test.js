import { test, expect } from 'vitest';
import { degreesPerCount, cmPer360 } from '../src/core/sensitivity.js';

test('valorant degrees per count', () => {
  expect(degreesPerCount(0.194)).toBeCloseTo(0.01358, 5);
});

test('cm per 360 for 1600 dpi / 0.194', () => {
  expect(cmPer360(1600, 0.194)).toBeCloseTo(42.08, 1);
});
