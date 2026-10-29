import { test, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, parseSettingsText } from '../src/core/settings.js';

test('defaults hold user values', () => {
  expect(DEFAULT_SETTINGS.mouse).toEqual({ dpi: 1600, sens: 0.194 });
  expect(DEFAULT_SETTINGS.hfov).toBe(103);
  expect(DEFAULT_SETTINGS.crosshairCode).toBe('0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002');
});

test('mergeSettings fills missing keys', () => {
  const s = mergeSettings({ mouse: { sens: 0.3 } });
  expect(s.mouse.sens).toBe(0.3);
  expect(s.mouse.dpi).toBe(1600);
  expect(s.hfov).toBe(103);
});

test('mergeSettings replaces arrays whole and rejects wrong types', () => {
  const s = mergeSettings({ hfov: 'x', session: { nextBotDelay: [1, 2] } });
  expect(s.hfov).toBe(103);
  expect(s.session.nextBotDelay).toEqual([1, 2]);
  expect(mergeSettings({ session: { nextBotDelay: 'no' } }).session.nextBotDelay).toEqual([0.5, 1.5]);
});

test('mergeSettings does not mutate defaults', () => {
  const s = mergeSettings({});
  s.mouse.sens = 9;
  expect(DEFAULT_SETTINGS.mouse.sens).toBe(0.194);
});

test('corrupt json falls back to defaults', () => {
  expect(parseSettingsText('{oops')).toEqual(DEFAULT_SETTINGS);
  expect(parseSettingsText(null)).toEqual(DEFAULT_SETTINGS);
  expect(parseSettingsText('[1,2]')).toEqual(DEFAULT_SETTINGS);
});

test('arrays with wrong length or element type fall back to defaults', () => {
  const s = mergeSettings({
    session: { nextBotDelay: [] },
    peek: { exposedTime: [0.5], hiddenTime: ['a', 1] },
    buckets: { distance: [10, 20], enabled: { distance: [true, true] } },
  });
  expect(s.session.nextBotDelay).toEqual([0.5, 1.5]);
  expect(s.peek.exposedTime).toEqual([0.25, 0.9]);
  expect(s.peek.hiddenTime).toEqual([0.3, 1.2]);
  expect(s.buckets.distance).toEqual([[5, 15], [15, 30], [30, 50]]);
  expect(s.buckets.enabled.distance).toEqual([true, true, true]);
  expect(mergeSettings({ buckets: { distance: [[0, 10], [10, 20], [20, 60]] } }).buckets.distance).toEqual([[0, 10], [10, 20], [20, 60]]);
});

test('key numbers are clamped to usable values', () => {
  const s = mergeSettings({ mouse: { sens: 0, dpi: -5 }, session: { botCount: 0 }, hfov: 500 });
  expect(s.mouse.sens).toBe(0.194);
  expect(s.mouse.dpi).toBe(1600);
  expect(s.session.botCount).toBe(30);
  expect(s.hfov).toBe(103);
});
