import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createBotModel, BOT_DIMENSIONS } from '../src/game/botModel.js';

const colors = { head: '#ff4655', body: '#3a4250', legs: '#2a303a' };

function headBox(bot) {
  bot.root.updateMatrixWorld(true);
  const h = bot.hitboxes.find((m) => m.userData.part === 'head');
  return new THREE.Box3().setFromObject(h);
}

test('has head, body and legs hitboxes', () => {
  const bot = createBotModel(colors);
  const parts = new Set(bot.hitboxes.map((m) => m.userData.part));
  expect(parts).toEqual(new Set(['head', 'body', 'legs']));
});

test('standing head center is at the agent head height', () => {
  const bot = createBotModel(colors);
  bot.setPose({ strafeVel: 0, crouch: 0, t: 0 });
  const c = headBox(bot).getCenter(new THREE.Vector3());
  expect(c.y).toBeCloseTo(BOT_DIMENSIONS.headCenter, 2);
  expect(bot.headWorldPos().y).toBeCloseTo(BOT_DIMENSIONS.headCenter, 2);
});

test('crouch lowers the head hitbox and it follows the root position', () => {
  const bot = createBotModel(colors);
  bot.root.position.set(5, 3, -10);
  bot.setPose({ strafeVel: 0, crouch: 1, t: 0 });
  const c = headBox(bot).getCenter(new THREE.Vector3());
  expect(c.y).toBeLessThan(3 + BOT_DIMENSIONS.headCenter - 0.3);
  expect(c.x).toBeCloseTo(5, 0);
});

test('strafing keeps head hitbox on the head mesh', () => {
  const bot = createBotModel(colors);
  for (const t of [0, 0.13, 0.27, 0.4]) {
    bot.setPose({ strafeVel: 5.4, crouch: 0, t });
    const hb = headBox(bot);
    expect(hb.containsPoint(bot.headWorldPos())).toBe(true);
  }
});
