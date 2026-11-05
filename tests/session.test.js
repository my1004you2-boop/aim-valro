import { test, expect } from 'vitest';
import * as THREE from 'three';
import M from '../data/movement.json';
import range from '../data/range.json';
import { createSession } from '../src/game/session.js';
import { createLook } from '../src/game/look.js';
import { buildWorld } from '../src/game/world.js';
import { createPlayer, eyeHeight } from '../src/core/physics.js';
import { mergeSettings } from '../src/core/settings.js';
import { coversFor } from '../src/core/covers.js';
import { castShot } from '../src/game/shooting.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const laser = (o = {}) => ({
  name: 'Laser', auto: false, fireRate: 5, magazine: 100, reloadTime: 1, moveSpeedMul: 0.8, equipTime: 0.5,
  damage: [{ maxRange: 999, head: 160, body: 40, legs: 34 }],
  spread: { stand: 0, crouch: 0, walk: 0, run: 0, air: 0 },
  firingError: { perShot: 0, max: 0, recovery: 0.1 },
  recoil: { pitchPerShot: 0, yawJitter: 0, recoverRate: 6 },
  ...o,
});

function setup({ mode = 'peek', judge = 'head', armor = 0, botCount = 2, settings: extra = {}, at = range.spawn, botFire = 'off', brakeJudge = false } = {}) {
  const scene = new THREE.Scene();
  const world = buildWorld(scene, range);
  scene.updateMatrixWorld(true);
  const player = createPlayer({ x: at.x, y: at.y, z: at.z });
  const look = createLook({ sens: 0.194 });
  const input = { keys: new Set(), mouseDown: false, pressedThisFrame: false };
  const settings = mergeSettings({
    session: { botCount, nextBotDelay: [0, 0], coverHighlight: false },
    ...extra,
  });
  const ctx = {
    scene, look, player, world, input, M,
    weapons: { laser: laser(), side: laser({ name: 'Side', magazine: 12, equipTime: 0.4 }) },
    knife: { name: 'Knife', melee: true, range: 2, equipTime: 0.3, moveSpeedMul: 1, light: { damage: 50, interval: 0.4 }, heavy: { damage: 75, interval: 1 } },
    armorRules: { absorb: 1 },
    audio: { shot() {}, head() {}, body() {}, kill() {}, step() {}, swing() {}, enemyShot() {}, hurt() {}, death() {}, cue() {} },
    eye: () => new THREE.Vector3(player.pos.x, player.pos.y + eyeHeight(player, M), player.pos.z),
    rng: rng(42),
  };
  const session = createSession({ mode, loadout: { primary: 'laser', secondary: 'side' }, judge, armor, botFire, brakeJudge, settings, ctx, walls: range.walls });
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

test('peek bot stays hidden while the cover highlight shows, and highlights never leak', () => {
  const env = setup({ botCount: 3, settings: { session: { botCount: 3, nextBotDelay: [0, 0], coverHighlight: true } } });
  const { scene, session } = env;
  const dt = 1 / 120;
  let spawnAt = null;
  let maxHighlights = 0;
  for (let now = 0; now < 60 && !session.isDone(); now += dt) {
    session.update(dt, now);
    scene.updateMatrixWorld(true);
    const hl = [];
    scene.traverse((o) => o.userData.role === 'coverHighlight' && hl.push(o));
    maxHighlights = Math.max(maxHighlights, hl.length);
    const head = find(scene, (o) => o.userData.part === 'head');
    if (head && spawnAt === null) spawnAt = now;
    if (head && hl.length) {
      const root = find(scene, (o) => o.userData.role === 'bot');
      const c = coversFor(range.walls, range.boxes.filter((b) => !b.deco), range.spawn).find((x) => Math.abs(x.hide.x - root.position.x) < 1e-6 && Math.abs(x.hide.z - root.position.z) < 1e-6);
      expect(c, 'bot must sit at its hide spot during highlight').toBeTruthy();
    }
    if (head && !hl.length) {
      aimAt(env.ctx, head.getWorldPosition(new THREE.Vector3()));
      env.input.pressedThisFrame = true;
    } else env.input.pressedThisFrame = false;
  }
  expect(session.isDone()).toBe(true);
  expect(maxHighlights).toBeLessThanOrEqual(1);
  let left = 0;
  scene.traverse((o) => o.userData.role === 'coverHighlight' && left++);
  expect(left).toBe(0);
});

test('a blind shot at a hidden bot does not start the kill clock', () => {
  const env = setup({ botCount: 1, settings: { peek: { hiddenTime: [1, 1], exposedTime: [0.5, 0.5], wideRatio: 1 } } });
  const { scene, session, ctx, input } = env;
  const dt = 1 / 120;
  let blindAt = null;
  for (let now = 0; now < 30 && !session.isDone(); now += dt) {
    input.pressedThisFrame = false;
    const head = find(scene, (o) => o.userData.part === 'head');
    if (head) {
      aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
      if (blindAt === null) {
        blindAt = now;
        input.pressedThisFrame = true;
      } else if (now > blindAt + 1.2) input.pressedThisFrame = true;
    }
    session.update(dt, now);
    scene.updateMatrixWorld(true);
  }
  const [r] = session.records();
  expect(r.shots[0].part).toBe(null);
  expect(r.firstSeenAt).toBeGreaterThan(blindAt + 0.9);
});

test('each shot leaves a tracer, wall shots leave impact marks, kills report a streak', () => {
  const env = setup({ botCount: 2 });
  const streaks = [];
  env.ctx.audio.kill = (n) => streaks.push(n);
  let tracers = 0;
  let impacts = 0;
  const { scene, session, input } = env;
  for (let now = 0, i = 0; now < 0.3; now += 1 / 120, i++) {
    input.pressedThisFrame = i === 0;
    session.update(1 / 120, now);
  }
  scene.traverse((o) => {
    if (o.userData.role === 'tracer') tracers++;
    if (o.userData.role === 'impact') impacts++;
  });
  expect(tracers + impacts).toBeGreaterThan(0);
  play(env, 'head', 60);
  expect(streaks).toHaveLength(2);
  expect(streaks.every((n) => n >= 1 && n <= 5)).toBe(true);
  session.dispose();
  let left = 0;
  scene.traverse((o) => ['tracer', 'impact', 'spark'].includes(o.userData.role) && left++);
  expect(left).toBe(0);
});

test('hud reports the last shot time and reload progress for the gun view', () => {
  const env = setup({ botCount: 1 });
  const { session, input } = env;
  input.pressedThisFrame = true;
  session.update(1 / 120, 1);
  expect(session.hud().shotAt).toBe(1);
  expect(session.hud().reloadProgress).toBe(null);
  input.pressedThisFrame = false;
  input.keys.add('KeyR');
  session.update(1 / 120, 1.5);
  input.keys.clear();
  session.update(1 / 120, 2);
  expect(session.hud().reloadProgress).toBeCloseTo(0.5, 2);
});

// 맵 반대편 끝, 구덩이 안, 발판 위에서도 봇은 숨은 채로 나와야 한다.
for (const [name, at] of [['far end', { x: 0, y: 0, z: -46 }], ['canal', { x: -11, y: -1.8, z: -41 }], ['terrace', { x: 11, y: 1.8, z: -40 }]]) {
  test(`bots spawn hidden behind walls relative to the player (${name})`, () => {
    const env = setup({ botCount: 8, at, settings: { session: { botCount: 8, nextBotDelay: [0, 0], coverHighlight: false }, peek: { hiddenTime: [0.5, 0.5] } } });
    const { scene, session, ctx } = env;
    const dt = 1 / 120;
    let lastRoot = null;
    let checked = 0;
    for (let now = 0; now < 120 && !session.isDone(); now += dt) {
      env.input.pressedThisFrame = false;
      const root = find(scene, (o) => o.userData.role === 'bot');
      if (root && root !== lastRoot) {
        lastRoot = root;
        scene.updateMatrixWorld(true);
        const eye = ctx.eye();
        for (const y of [1.6, 1.1]) {
          const p = root.position.clone().add(new THREE.Vector3(0, y, 0));
          const r = castShot({ origin: eye, dir: p.clone().sub(eye).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] });
          expect(r.distance, `${name}: bot ${checked} at y+${y} visible while hidden`).toBeLessThan(p.distanceTo(eye) - 0.05);
        }
        checked++;
      }
      const head = find(scene, (o) => o.userData.part === 'head');
      if (head && root && root.userData.peeked) {
        aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
        env.input.pressedThisFrame = true;
      }
      session.update(dt, now);
      scene.updateMatrixWorld(true);
      if (root && find(scene, (o) => o.userData.role === 'bot') === root) {
        const r2 = castShot({ origin: ctx.eye(), dir: head.getWorldPosition(new THREE.Vector3()).sub(ctx.eye()).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [head] });
        if (r2.part === 'head') root.userData.peeked = true;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
}

test('a peeking bot makes footsteps at its position, and none while it waits hidden', () => {
  const env = setup({ botCount: 1, settings: { peek: { hiddenTime: [1, 1], exposedTime: [0.5, 0.5], wideRatio: 1 } } });
  const steps = [];
  let firstMove = null;
  env.ctx.audio.step = (pos) => steps.push({ pos: { ...pos }, t: now });
  const { scene, session } = env;
  let now = 0;
  let lastPos = null;
  for (; now < 4; now += 1 / 120) {
    session.update(1 / 120, now);
    const root = find(scene, (o) => o.userData.role === 'bot');
    if (root) {
      if (lastPos && firstMove === null && root.position.distanceTo(lastPos) > 1e-6) firstMove = now;
      lastPos = root.position.clone();
    }
  }
  expect(firstMove).not.toBe(null);
  expect(steps.length).toBeGreaterThan(1);
  expect(steps.every((s) => s.t >= firstMove - 1e-9)).toBe(true);
  const root = find(scene, (o) => o.userData.role === 'bot');
  expect(Math.hypot(steps[0].pos.x - root.position.x, steps[0].pos.z - root.position.z)).toBeLessThan(3);
});

test('footsteps can be turned off', () => {
  const env = setup({ botCount: 1, settings: { audio: { enabled: true, volume: 0.6, footsteps: false }, peek: { hiddenTime: [0.2, 0.2] } } });
  let steps = 0;
  env.ctx.audio.step = () => steps++;
  for (let now = 0; now < 4; now += 1 / 120) env.session.update(1 / 120, now);
  expect(steps).toBe(0);
});

// ── 무기 교체(1 주무기, 2 보조무기, 3 칼) ──
function tick(env, now, keys = [], fire = false) {
  env.input.keys = new Set(keys);
  env.input.pressedThisFrame = fire;
  env.input.mouseDown = fire;
  env.session.update(1 / 120, now);
}

test('number keys swap primary, secondary and knife, each with its own ammo', () => {
  const env = setup({ botCount: 1 });
  expect(env.session.hud().slot).toBe(1);
  tick(env, 1, [], true);
  expect(env.session.hud().ammo).toBe(99);
  tick(env, 1.1, ['Digit2']);
  expect(env.session.hud()).toMatchObject({ slot: 2, weaponId: 'side', ammo: 12, magazine: 12 });
  tick(env, 2, ['Digit3']);
  expect(env.session.hud()).toMatchObject({ slot: 3, weaponId: 'knife', ammo: null });
  tick(env, 3, ['Digit1']);
  expect(env.session.hud()).toMatchObject({ slot: 1, weaponId: 'laser', ammo: 99 });
  expect(env.session.hud().slots.map((x) => x.name)).toEqual(['Laser', 'Side', 'Knife']);
});

test('a freshly drawn weapon cannot fire until its equip time passes', () => {
  const env = setup({ botCount: 1 });
  tick(env, 1, ['Digit2']);
  tick(env, 1.2, [], true);
  expect(env.session.hud().ammo).toBe(12);
  tick(env, 1.45, [], true);
  expect(env.session.hud().ammo).toBe(11);
});

test('swapping away cancels a reload', () => {
  const env = setup({ botCount: 1 });
  tick(env, 1, [], true);
  tick(env, 1.5, ['KeyR']);
  expect(env.session.hud().reloading).toBe(true);
  tick(env, 1.6, ['Digit2']);
  tick(env, 3, ['Digit1']);
  expect(env.session.hud()).toMatchObject({ reloading: false, ammo: 99 });
});

test('the knife only reaches a couple of metres and records its swings', () => {
  const env = setup({ botCount: 1, settings: { peek: { hiddenTime: [0.2, 0.2], exposedTime: [3, 3], wideRatio: 1 } } });
  const { scene, session, ctx } = env;
  let swings = 0;
  ctx.audio.swing = () => swings++;
  tick(env, 0, ['Digit3']);
  for (let now = 0.01; now < 6; now += 1 / 120) {
    const head = find(scene, (o) => o.userData.part === 'head');
    if (head) aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
    tick(env, now, [], now > 0.5);
  }
  expect(swings).toBeGreaterThan(3);
  expect(session.isDone()).toBe(false);
});

// ── 봇 반격 ──
test('with return fire off the player never takes damage', () => {
  const env = setup({ botCount: 3 });
  play(env, 'head', 10, { shoot: false });
  expect(env.session.hud()).toMatchObject({ hp: 100, armor: 50 });
});

test('hard bots shoot back: the player gets hurt and can die, which ends that duel', () => {
  const env = setup({ botCount: 3, botFire: 'hard', settings: { peek: { hiddenTime: [0.3, 0.3], exposedTime: [1.5, 1.5] } } });
  let shots = 0;
  env.ctx.audio.enemyShot = () => shots++;
  let minHp = 100;
  const dt = 1 / 120;
  for (let now = 0; now < 120 && !env.session.isDone(); now += dt) {
    env.session.update(dt, now);
    env.scene.updateMatrixWorld(true);
    minHp = Math.min(minHp, env.session.hud().hp);
  }
  expect(shots).toBeGreaterThan(0);
  expect(minHp).toBeLessThan(100);
  const rec = env.session.records();
  expect(rec.some((r) => r.died)).toBe(true);
  expect(rec.filter((r) => r.died).every((r) => r.killedAt === null)).toBe(true);
});

test('default settings remember a primary, a secondary and the return-fire level', () => {
  expect(mergeSettings({}).last).toMatchObject({ primary: 'vandal', secondary: 'classic', botFire: 'off' });
  expect(mergeSettings({}).keys).toMatchObject({ slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3' });
});

// ── 무기 교환(B) ──
test('buying replaces the primary or secondary with a full magazine', () => {
  const env = setup({ botCount: 1 });
  tick(env, 1, [], true);
  env.session.buy('primary', 'side', 1.5);
  expect(env.session.hud()).toMatchObject({ slot: 1, weaponId: 'side', ammo: 12 });
  expect(env.session.hud().slots.map((x) => x.name)).toEqual(['Side', 'Side', 'Knife']);
  env.session.buy('secondary', 'laser', 1.6);
  expect(env.session.hud().slots.map((x) => x.name)).toEqual(['Side', 'Laser', 'Knife']);
  expect(env.session.loadout()).toEqual({ primary: 'side', secondary: 'laser' });
});

test('a weapon bought into the hand has to be drawn before it fires', () => {
  const env = setup({ botCount: 1 });
  env.session.buy('primary', 'side', 1);
  tick(env, 1.2, [], true);
  expect(env.session.hud().ammo).toBe(12);
  tick(env, 1.45, [], true);
  expect(env.session.hud().ammo).toBe(11);
});

// ── 모드 A: 플릭 전환 ──
test('flick mode: a bot appears within the angle range of the current aim, standing on visible ground', () => {
  const env = setup({ mode: 'flick', botCount: 6 });
  const { scene, session, ctx } = env;
  const seen = [];
  let last = null;
  for (let now = 0; now < 30 && !session.isDone(); now += 1 / 120) {
    const root = find(scene, (o) => o.userData.role === 'bot');
    if (root && root !== last) {
      last = root;
      scene.updateMatrixWorld(true);
      const head = find(scene, (o) => o.userData.part === 'head').getWorldPosition(new THREE.Vector3());
      const eye = ctx.eye();
      const to = head.clone().sub(eye).normalize();
      const f = ctx.look.forward();
      const deg = (Math.acos(Math.min(1, f.x * to.x + f.y * to.y + f.z * to.z)) * 180) / Math.PI;
      const r = castShot({ origin: eye, dir: to, worldMeshes: ctx.world.meshes, botHitboxes: [] });
      seen.push({ deg, visible: r.distance >= head.distanceTo(eye) - 0.05, dist: head.distanceTo(eye) });
    }
    const head = root && find(scene, (o) => o.userData.part === 'head');
    if (head) aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
    env.input.pressedThisFrame = !!head;
    session.update(1 / 120, now);
    scene.updateMatrixWorld(true);
  }
  expect(seen.length).toBe(6);
  for (const s of seen) {
    expect(s.deg).toBeGreaterThanOrEqual(7.5);
    expect(s.deg).toBeLessThanOrEqual(76);
    expect(s.visible).toBe(true);
    expect(s.dist).toBeGreaterThan(5);
  }
  const rec = session.records();
  expect(rec.every((r) => r.killedAt !== null && r.flickDeg >= 7.5 && r.flickResidual !== null)).toBe(true);
});

test('flick mode: not shooting fails each target after the time limit', () => {
  const env = setup({ mode: 'flick', botCount: 2 });
  play(env, 'head', 10, { shoot: false });
  const rec = env.session.records();
  expect(rec).toHaveLength(2);
  expect(rec.every((r) => r.failed && r.killedAt === null)).toBe(true);
});

// ── 모드 B: 각 확인 ──
const solidBoxes = range.boxes.filter((b) => !b.deco);
const roles = (scene, role) => {
  const out = [];
  scene.traverse((o) => o.userData.role === role && out.push(o));
  return out;
};
const clearSettings = (o = {}) => ({ session: { botCount: 6, nextBotDelay: [0, 0], coverHighlight: false }, clear: { waveSize: 3, revealAfter: 20, ...o } });

test('clear mode: a wave of bots stands hidden behind walls all at once', () => {
  const env = setup({ mode: 'clear', botCount: 6, settings: clearSettings() });
  for (let now = 0; now < 1; now += 1 / 120) env.session.update(1 / 120, now);
  env.scene.updateMatrixWorld(true);
  const bots = roles(env.scene, 'bot');
  expect(bots).toHaveLength(3);
  const eye = env.ctx.eye();
  for (const b of bots) {
    const head = b.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const r = castShot({ origin: eye, dir: head.clone().sub(eye).normalize(), worldMeshes: env.ctx.world.meshes, botHitboxes: [] });
    expect(r.distance).toBeLessThan(head.distanceTo(eye) - 0.05);
  }
});

test('clear mode: walking up to each bot and shooting it clears the wave, then the next wave comes', async () => {
  const { standable } = await import('../src/core/covers.js');
  const env = setup({ mode: 'clear', botCount: 6, settings: clearSettings() });
  const { scene, session, ctx, input } = env;
  const dt = 1 / 120;
  for (let now = 0; now < 120 && !session.isDone(); now += dt) {
    input.pressedThisFrame = false;
    scene.updateMatrixWorld(true);
    const target = roles(scene, 'bot')[0];
    if (target) {
      const head = target.getObjectByProperty('name', 'head') ?? find(target, (o) => o.userData.part === 'head');
      const hp = head.getWorldPosition(new THREE.Vector3());
      const eye = ctx.eye();
      const seen = castShot({ origin: eye, dir: hp.clone().sub(eye).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] }).distance >= hp.distanceTo(eye) - 0.05;
      if (!seen) {
        // 봇 주변에서 머리가 보이는 자리로 걸어간다(테스트에서는 순간 이동).
        let moved = false;
        for (let r = 3; r <= 9 && !moved; r += 2) {
          for (let k = 0; k < 16 && !moved; k++) {
            const a = (k / 16) * Math.PI * 2;
            const p = { x: target.position.x + Math.cos(a) * r, y: target.position.y, z: target.position.z + Math.sin(a) * r };
            if (!standable(p, p.y, solidBoxes)) continue;
            const e = new THREE.Vector3(p.x, p.y + 1.6, p.z);
            const ok = castShot({ origin: e, dir: hp.clone().sub(e).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] }).distance >= hp.distanceTo(e) - 0.05;
            if (ok) {
              ctx.player.pos = { ...p };
              moved = true;
            }
          }
        }
      } else {
        aimAt(ctx, hp);
        input.pressedThisFrame = true;
      }
    }
    session.update(dt, now);
  }
  const rec = session.records();
  expect(rec).toHaveLength(6);
  for (const r of rec) {
    expect(r.killedAt).not.toBe(null);
    expect(r.firstSeenAt).not.toBe(null);
    expect(r.placementErr).not.toBe(null);
    expect(r.wave).toBeGreaterThanOrEqual(1);
  }
  expect(new Set(rec.map((r) => r.wave))).toEqual(new Set([1, 2]));
});

test('clear mode: bots nobody finds get a marker after a while', () => {
  const env = setup({ mode: 'clear', botCount: 6, settings: clearSettings({ revealAfter: 2 }) });
  for (let now = 0; now < 1.5; now += 1 / 120) env.session.update(1 / 120, now);
  expect(roles(env.scene, 'reveal')).toHaveLength(0);
  for (let now = 1.5; now < 3; now += 1 / 120) env.session.update(1 / 120, now);
  expect(roles(env.scene, 'reveal')).toHaveLength(3);
  env.session.dispose();
  expect(roles(env.scene, 'reveal').length + roles(env.scene, 'bot').length).toBe(0);
});

test('flick mode has an endless magazine and never reloads', () => {
  const env = setup({ mode: 'flick', botCount: 200 });
  for (let i = 0; i < 300; i++) tick(env, i * 0.21, i === 100 ? ['KeyR'] : [], true);
  expect(env.session.hud()).toMatchObject({ ammo: 100, reloading: false, infiniteAmmo: true });
  tick(env, 70, ['Digit2']);
  for (let i = 0; i < 30; i++) tick(env, 71 + i * 0.21, [], true);
  expect(env.session.hud()).toMatchObject({ ammo: 12, reloading: false });
});

test('other modes still use up the magazine', () => {
  const env = setup({ botCount: 3 });
  for (let i = 0; i < 5; i++) tick(env, 1 + i * 0.21, [], true);
  expect(env.session.hud()).toMatchObject({ ammo: 95, infiniteAmmo: false });
});

// ── 브레이킹 ──
test('every shot records how the player was moving, and the hud shows it right away', () => {
  const env = setup({ botCount: 2 });
  tick(env, 1, [], true);
  expect(env.session.hud().lastShot).toMatchObject({ kind: 'still', accurate: true });
  env.ctx.player.vel = { x: 6, y: 0, z: 0 };
  for (let i = 0; i < 30; i++) tick(env, 1.3 + i / 120, ['KeyD'], i === 29);
  expect(env.session.hud().lastShot).toMatchObject({ kind: 'moving', accurate: false });
  play(env, 'head', 60);
  const shots = env.session.records().flatMap((r) => r.shots);
  expect(shots.every((s) => s.brake && typeof s.brake.kind === 'string')).toBe(true);
});

test('with braking judge on, a head shot fired while moving does not count', () => {
  const env = setup({ botCount: 1, brakeJudge: true, settings: { peek: { hiddenTime: [0.2, 0.2], exposedTime: [5, 5], wideRatio: 1 } } });
  const { scene, session, ctx, input } = env;
  let fired = false;
  for (let now = 0; now < 5 && !fired; now += 1 / 120) {
    const head = find(scene, (o) => o.userData.part === 'head');
    ctx.player.vel = { x: 6, y: 0, z: 0 };
    input.pressedThisFrame = false;
    if (head && session.records().length === 0) {
      scene.updateMatrixWorld(true);
      const hp = head.getWorldPosition(new THREE.Vector3());
      const eye = ctx.eye();
      if (castShot({ origin: eye, dir: hp.clone().sub(eye).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] }).distance >= hp.distanceTo(eye) - 0.05) {
        aimAt(ctx, hp);
        input.pressedThisFrame = true;
        fired = true;
      }
    }
    session.update(1 / 120, now);
  }
  expect(fired).toBe(true);
  expect(session.records()).toHaveLength(0);
  expect(session.hud().lastShot).toMatchObject({ kind: 'moving', voided: true });
});

// ── 브레이킹 연습 모드 ──
test('strafe mode: the cue only comes while the player is running, and the bot cannot die before it', () => {
  const env = setup({ mode: 'strafe', botCount: 2 });
  const { scene, session, ctx } = env;
  for (let now = 0; now < 3; now += 1 / 120) {
    const head = find(scene, (o) => o.userData.part === 'head');
    if (head) aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
    tick(env, now, [], !!head);
  }
  expect(roles(scene, 'bot')).toHaveLength(1);
  expect(roles(scene, 'cue')).toHaveLength(0);
  expect(session.records()).toHaveLength(0);
  expect(session.hud().strafe).toMatchObject({ cue: false });
  // 달리기 시작하면 잠시 뒤 신호가 온다.
  let cueAt = null;
  for (let now = 3; now < 6 && cueAt === null; now += 1 / 120) {
    ctx.player.vel = { x: 6, y: 0, z: 0 };
    tick(env, now, ['KeyD']);
    if (roles(scene, 'cue').length) cueAt = now;
  }
  expect(cueAt).not.toBe(null);
  // 신호 뒤 브레이킹하고 헤드를 맞히면 처치, 반응 시간이 기록된다.
  ctx.player.vel = { x: 0, y: 0, z: 0 };
  for (let now = cueAt + 0.01; now < cueAt + 1 && session.records().length === 0; now += 1 / 120) {
    const head = find(scene, (o) => o.userData.part === 'head');
    aimAt(ctx, head.getWorldPosition(new THREE.Vector3()));
    tick(env, now, ['KeyA'], now > cueAt + 0.2);
  }
  const [r] = session.records();
  expect(r.killedAt).not.toBe(null);
  expect(r.cueAt).toBeCloseTo(cueAt, 5);
  expect(r.reaction).toBeGreaterThan(0.15);
  expect(r.shots[0].brake.accurate).toBe(true);
});

test('strafe mode: no head shot within the time limit after the cue fails the round', () => {
  const env = setup({ mode: 'strafe', botCount: 1 });
  for (let now = 0; now < 8; now += 1 / 120) {
    env.ctx.player.vel = { x: 6, y: 0, z: 0 };
    tick(env, now, ['KeyD']);
  }
  const [r] = env.session.records();
  expect(r.failed).toBe(true);
  expect(r.cueAt).not.toBe(null);
});

test('the hud reports the live speed against the deadzone', () => {
  const env = setup({ botCount: 1 });
  env.ctx.player.vel = { x: M.runSpeed / 2, y: 0, z: 0 };
  tick(env, 1, ['KeyD']);
  expect(env.session.hud().speed).toBeCloseTo(0.5, 1);
  expect(env.session.hud().deadzone).toBe(M.accurateSpeedFraction);
});
