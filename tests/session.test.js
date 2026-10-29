import { test, expect } from 'vitest';
import * as THREE from 'three';
import M from '../data/movement.json';
import range from '../data/range.json';
import { createSession } from '../src/game/session.js';
import { createLook } from '../src/game/look.js';
import { buildWorld } from '../src/game/world.js';
import { createPlayer, eyeHeight } from '../src/core/physics.js';
import { mergeSettings } from '../src/core/settings.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const laser = (o = {}) => ({
  name: 'Laser', auto: false, fireRate: 5, magazine: 100, reloadTime: 1, moveSpeedMul: 0.8,
  damage: [{ maxRange: 999, head: 160, body: 40, legs: 34 }],
  spread: { stand: 0, crouch: 0, walk: 0, run: 0, air: 0 },
  firingError: { perShot: 0, max: 0, recovery: 0.1 },
  recoil: { pitchPerShot: 0, yawJitter: 0, recoverRate: 6 },
  ...o,
});

function setup({ mode = 'peek', judge = 'head', armor = 0, botCount = 2, settings: extra = {} } = {}) {
  const scene = new THREE.Scene();
  const world = buildWorld(scene, range);
  scene.updateMatrixWorld(true);
  const player = createPlayer({ x: range.spawn.x, y: range.spawn.y, z: range.spawn.z });
  const look = createLook({ sens: 0.194 });
  const input = { keys: new Set(), mouseDown: false, pressedThisFrame: false };
  const settings = mergeSettings({
    session: { botCount, nextBotDelay: [0, 0], coverHighlight: false },
    ...extra,
  });
  const ctx = {
    scene, look, player, world, input, M,
    weapons: { laser: laser() },
    armorRules: { absorb: 1 },
    audio: { shot() {}, head() {}, body() {}, kill() {} },
    eye: () => new THREE.Vector3(player.pos.x, player.pos.y + eyeHeight(player, M), player.pos.z),
    rng: rng(42),
  };
  const session = createSession({ mode, weaponId: 'laser', judge, armor, settings, ctx, covers: range.covers });
  return { scene, session, ctx, input, look };
}

function find(scene, pred) {
  let out = null;
  scene.traverse((o) => {
    if (!out && pred(o)) out = o;
  });
  return out;
}

function aimAt(ctx, target) {
  const d = target.clone().sub(ctx.eye()).normalize();
  ctx.look.yaw = Math.atan2(-d.x, -d.z);
  ctx.look.pitch = Math.asin(d.y);
}

// part 부위를 조준해서 0.25초마다 쏜다.
function play(env, part, seconds, { shoot = true } = {}) {
  const { scene, session, ctx, input } = env;
  const dt = 1 / 120;
  let nextShot = 0;
  for (let now = 0; now < seconds && !session.isDone(); now += dt) {
    input.pressedThisFrame = false;
    const dot = find(scene, (o) => o.userData.role === 'microDot');
    const hit = find(scene, (o) => o.userData.part === part);
    if (dot) aimAt(ctx, dot.position);
    else if (hit) aimAt(ctx, hit.getWorldPosition(new THREE.Vector3()));
    if (shoot && hit && !dot && now >= nextShot) {
      input.pressedThisFrame = true;
      nextShot = now + 0.25;
    }
    session.update(dt, now);
    scene.updateMatrixWorld(true);
  }
}

test('peek mode: head shots kill each peeking bot and are recorded', () => {
  const env = setup();
  play(env, 'head', 60);
  const rec = env.session.records();
  expect(env.session.isDone()).toBe(true);
  expect(rec).toHaveLength(2);
  for (const r of rec) {
    expect(r.killedAt).not.toBe(null);
    expect(r.shots.at(-1).part).toBe('head');
    expect(r.placementErr).not.toBe(null);
    expect(r.firstSeenAt).not.toBe(null);
    expect(r.d).not.toBe(null);
    expect(['short', 'wide']).toContain(r.kind);
  }
});

test('head-only judge: body shots never kill', () => {
  const env = setup({ botCount: 1 });
  play(env, 'body', 8);
  expect(env.session.isDone()).toBe(false);
  expect(env.session.records()).toHaveLength(0);
  expect(env.session.hud().headRate).toBe(0);
});

test('kill judge: body shots kill through heavy armor in 4 hits', () => {
  const env = setup({ judge: 'kill', armor: 50, botCount: 1 });
  play(env, 'body', 60);
  const [r] = env.session.records();
  expect(r.killedAt).not.toBe(null);
  expect(r.shots.filter((s) => s.part === 'body')).toHaveLength(4);
});

test('micro mode: bot appears after holding the start dot, then is killed', () => {
  const env = setup({ mode: 'micro', botCount: 2 });
  play(env, 'head', 30);
  const rec = env.session.records();
  expect(rec).toHaveLength(2);
  expect(rec.every((r) => r.killedAt !== null && !r.failed)).toBe(true);
});

test('micro mode: not shooting fails after the time limit', () => {
  const env = setup({ mode: 'micro', botCount: 1 });
  play(env, 'head', 10, { shoot: false });
  const [r] = env.session.records();
  expect(r.failed).toBe(true);
  expect(r.killedAt).toBe(null);
});
