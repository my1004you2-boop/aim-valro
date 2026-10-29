import { test, expect } from 'vitest';
import { classifyBucket } from '../src/core/buckets.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

const cfg = DEFAULT_SETTINGS.buckets;
const P = { x: 0, y: 0, z: 0 };

test('distance and height buckets', () => {
  expect(classifyBucket(P, { x: 0, y: 0, z: -10 }, cfg)).toEqual({ d: 0, h: 1 });
  expect(classifyBucket(P, { x: 0, y: -3, z: -20 }, cfg)).toEqual({ d: 1, h: 0 });
  expect(classifyBucket(P, { x: 0, y: 2, z: -40 }, cfg)).toEqual({ d: 2, h: 2 });
  expect(classifyBucket(P, { x: 0, y: 0, z: -60 }, cfg).d).toBe(null);
});

test('closer than 5 m still counts as near; 1.5 m edge counts as same height', () => {
  expect(classifyBucket(P, { x: 0, y: 0, z: -3 }, cfg).d).toBe(0);
  expect(classifyBucket(P, { x: 0, y: 1.5, z: -10 }, cfg).h).toBe(1);
  expect(classifyBucket(P, { x: 0, y: -1.5, z: -10 }, cfg).h).toBe(1);
});
