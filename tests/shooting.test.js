import { test, expect } from 'vitest';
import * as THREE from 'three';
import { castShot, aimedPart } from '../src/game/shooting.js';
import { createBotModel } from '../src/game/botModel.js';

const colors = { head: '#f00', body: '#333', legs: '#222' };
const eye = new THREE.Vector3(0, 1.6, 0);

function setup(withWall = false) {
  const bot = createBotModel(colors);
  bot.root.position.set(0, 0, -10);
  bot.root.updateMatrixWorld(true);
  const worldMeshes = [];
  if (withWall) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.4), new THREE.MeshBasicMaterial());
    wall.position.set(0, 1.5, -5);
    wall.updateMatrixWorld(true);
    worldMeshes.push(wall);
  }
  return { bot, worldMeshes };
}
const toward = (p) => p.clone().sub(eye).normalize();

test('head hit', () => {
  const { bot, worldMeshes } = setup();
  const r = castShot({ origin: eye, dir: toward(bot.headWorldPos()), worldMeshes, botHitboxes: bot.hitboxes });
  expect(r.part).toBe('head');
  expect(r.distance).toBeCloseTo(10, 0);
});

test('body and legs hit', () => {
  const { bot, worldMeshes } = setup();
  expect(castShot({ origin: eye, dir: toward(new THREE.Vector3(0, 1.2, -10)), worldMeshes, botHitboxes: bot.hitboxes }).part).toBe('body');
  expect(castShot({ origin: eye, dir: toward(new THREE.Vector3(0.1, 0.4, -10)), worldMeshes, botHitboxes: bot.hitboxes }).part).toBe('legs');
});

test('wall in front blocks hitbox', () => {
  const { bot, worldMeshes } = setup(true);
  const r = castShot({ origin: eye, dir: toward(bot.headWorldPos()), worldMeshes, botHitboxes: bot.hitboxes });
  expect(r.part).toBe(null);
  expect(r.distance).toBeLessThan(6);
});

test('nearest hitbox wins', () => {
  const { bot, worldMeshes } = setup();
  // 머리 판정 앞에 가까운 몸 판정 상자를 하나 더 둔다.
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshBasicMaterial());
  shield.userData.part = 'body';
  shield.position.set(0, 1.6, -9);
  shield.updateMatrixWorld(true);
  const r = castShot({ origin: eye, dir: toward(bot.headWorldPos()), worldMeshes, botHitboxes: [...bot.hitboxes, shield] });
  expect(r.part).toBe('body');
});

test('miss into the sky', () => {
  const { bot, worldMeshes } = setup();
  const r = castShot({ origin: eye, dir: new THREE.Vector3(0, 1, 0), worldMeshes, botHitboxes: bot.hitboxes });
  expect(r.part).toBe(null);
  expect(r.point).toBe(null);
});

test('aimedPart ignores spread and reports the aimed part', () => {
  const { bot, worldMeshes } = setup();
  expect(aimedPart(eye, toward(bot.headWorldPos()), bot.hitboxes, worldMeshes)).toBe('head');
});
