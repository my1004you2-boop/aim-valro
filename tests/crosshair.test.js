import { test, expect } from 'vitest';
import { parseCrosshairCode, isCrosshairCode } from '../src/core/crosshair.js';
import { DEFAULT_SETTINGS } from '../src/core/settings.js';

test('user code parses to cyan 1px inner lines', () => {
  const c = parseCrosshairCode(DEFAULT_SETTINGS.crosshairCode);
  expect(c.color).toBe('#00FFFF');
  expect(c.centerDot.on).toBe(false);
  expect(c.outlines).toEqual({ on: true, thickness: 1, opacity: 0.101 });
  expect(c.inner).toEqual({ on: true, thickness: 1, length: 2, vLength: 2, offset: 1, opacity: 1 });
  expect(c.outer.on).toBe(false);
});

test('empty code gives valorant defaults', () => {
  const d = parseCrosshairCode('0');
  expect(d.color).toBe('#FFFFFF');
  expect(d.outlines).toEqual({ on: true, thickness: 1, opacity: 0.5 });
  expect(d.centerDot).toEqual({ on: false, thickness: 2, opacity: 1 });
  expect(d.inner).toEqual({ on: true, thickness: 2, length: 6, vLength: 6, offset: 3, opacity: 0.8 });
  expect(d.outer).toEqual({ on: true, thickness: 2, length: 2, vLength: 2, offset: 10, opacity: 0.35 });
});

test('custom color c;8 with u hex', () => {
  expect(parseCrosshairCode('0;P;c;8;u;12AB34FF').color).toBe('#12AB34');
});

test('vertical length only applies when 0g is on', () => {
  expect(parseCrosshairCode('0;P;0l;4;0v;9').inner.vLength).toBe(4);
  expect(parseCrosshairCode('0;P;0g;1;0l;4;0v;9').inner.vLength).toBe(9);
});

test('values outside the primary section are ignored', () => {
  expect(parseCrosshairCode('0;P;c;7;S;c;1').color).toBe('#FF0000');
  expect(parseCrosshairCode('0;P;c;1;A;c;7').color).toBe('#00FF00');
});

test('garbage input falls back to defaults', () => {
  expect(parseCrosshairCode('').color).toBe('#FFFFFF');
  expect(parseCrosshairCode('0;P;0t;abc').inner.thickness).toBe(2);
});

test('recognizes whether text is a crosshair code with a primary section', () => {
  expect(isCrosshairCode('0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002')).toBe(true);
  expect(isCrosshairCode('0;P;c;1')).toBe(true);
  expect(isCrosshairCode('')).toBe(false);
  expect(isCrosshairCode('hello world')).toBe(false);
  expect(isCrosshairCode('0;s;1;S;s;1')).toBe(false);
});
