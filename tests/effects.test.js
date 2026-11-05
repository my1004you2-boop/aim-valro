import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createEffects, MAX_IMPACTS } from '../src/game/effects.js';
import { mergeSettings } from '../src/core/settings.js';
import { SHOT_PROFILES } from '../src/game/audio.js';
import weaponData from '../data/weapons.json';

const count = (scene, role) => {
  let n = 0;
  scene.traverse((o) => o.userData.role === role && n++);
  return n;
};
const setup = (effects = {}) => {
  const scene = new THREE.Scene();
  const settings = mergeSettings({ effects });
  return { scene, settings, fx: createEffects(scene, settings) };
};
const from = new THREE.Vector3(0, 1.5, 0);
const to = new THREE.Vector3(0, 1.5, -30);

test('default settings turn tracers and impacts on', () => {
  expect(mergeSettings({}).effects).toEqual({ tracers: true, impacts: true });
});

test('a tracer travels to the hit point and then disappears', () => {
  const { scene, fx } = setup();
  fx.tracer(from, to, 0);
  expect(count(scene, 'tracer')).toBe(1);
  fx.update(0.05);
  expect(count(scene, 'tracer')).toBe(1);
  fx.update(1);
  expect(count(scene, 'tracer')).toBe(0);
});

test('impact marks stay a few seconds, are capped, and fade out', () => {
  const { scene, fx } = setup();
  const n = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < MAX_IMPACTS + 10; i++) fx.impact(new THREE.Vector3(i * 0.1, 1, -5), n, 0);
  expect(count(scene, 'impact')).toBe(MAX_IMPACTS);
  fx.update(2);
  expect(count(scene, 'impact')).toBe(MAX_IMPACTS);
  fx.update(30);
  expect(count(scene, 'impact')).toBe(0);
});

test('turning effects off adds nothing', () => {
  const { scene, fx } = setup({ tracers: false, impacts: false });
  fx.tracer(from, to, 0);
  fx.impact(to, new THREE.Vector3(0, 0, 1), 0);
  expect(count(scene, 'tracer') + count(scene, 'impact')).toBe(0);
});

test('clear removes every effect', () => {
  const { scene, fx } = setup();
  fx.tracer(from, to, 0);
  fx.impact(to, new THREE.Vector3(0, 0, 1), 0);
  fx.spark(to, 'head', 0);
  fx.clear();
  expect(scene.children).toHaveLength(0);
});

test('every weapon has a gunshot sound profile', () => {
  for (const w of Object.values(weaponData.weapons)) expect(SHOT_PROFILES[w.sound], w.name).toBeTruthy();
});
