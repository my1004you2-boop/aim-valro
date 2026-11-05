import { test, expect } from 'vitest';
import { keyLabel, overlayKeys } from '../src/ui/inputOverlay.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

test('key codes turn into short labels', () => {
  expect(keyLabel('KeyW')).toBe('W');
  expect(keyLabel('Digit2')).toBe('2');
  expect(keyLabel('ShiftLeft')).toBe('Shift');
  expect(keyLabel('ControlLeft')).toBe('Ctrl');
  expect(keyLabel('Space')).toBe('Space');
  expect(keyLabel('AltRight')).toBe('Alt');
  expect(keyLabel('Semicolon')).toBe('Semicolon');
});

test('the keyboard follows the key bindings and lights the held keys', () => {
  const rows = overlayKeys(DEFAULT_SETTINGS.keys, new Set(['KeyW', 'KeyD', 'ControlLeft']));
  const flat = rows.flat();
  expect(flat.map((k) => k.label)).toEqual(['1', '2', '3', 'R', 'W', 'B', 'A', 'S', 'D', 'Shift', 'Ctrl', 'Space']);
  expect(flat.filter((k) => k.on).map((k) => k.label)).toEqual(['W', 'D', 'Ctrl']);
  const custom = overlayKeys({ ...DEFAULT_SETTINGS.keys, forward: 'KeyE' }, new Set(['KeyE'])).flat();
  expect(custom.find((k) => k.on).label).toBe('E');
});
