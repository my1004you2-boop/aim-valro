import { test, expect } from 'vitest';
import { verticalFovDeg } from '../src/core/fov.js';

test('16:9 keeps 103 horizontal', () => {
  expect(verticalFovDeg(103, 16 / 9)).toBeCloseTo(70.53, 1);
});

test('wider than 16:9 is based on horizontal 103', () => {
  expect(verticalFovDeg(103, 21 / 9)).toBeCloseTo(56.6, 1);
});

test('narrower than 16:9 keeps 16:9 vertical', () => {
  expect(verticalFovDeg(103, 4 / 3)).toBeCloseTo(70.53, 1);
});
