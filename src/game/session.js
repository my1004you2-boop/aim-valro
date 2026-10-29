import * as THREE from 'three';
import { createWeaponState, tryFire, updateWeapon, startReload, currentSpreadDeg } from '../core/weapon.js';
import { damageAt, applyDamage } from '../core/damage.js';
import { sampleSpread } from '../core/spread.js';
import { createPeekBot, stepPeekBot, botWorldPos } from '../core/peek.js';
import { pickCover } from '../core/spawn.js';
import { classifyBucket } from '../core/buckets.js';
import { angleOffsets, stanceOf } from '../core/aim.js';
import { speedFraction } from '../core/physics.js';
import { castShot, aimedPart } from './shooting.js';
import { createBotModel } from './botModel.js';

const HIGHLIGHT_TIME = 0.6;
const HEAD_Y = 1.6;
const MICRO_DOT_RADIUS = 0.06;
const rad = (d) => (d * Math.PI) / 180;
const between = (rng, [a, b]) => a + (b - a) * rng();
const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
// 모드 2 봇은 숨지 않는다: 몸이 완전히 드러나는 위치를 중심으로 ±0.4m A/D 한다.
const MICRO_STRAFE = 0.4;
const microCenter = (cover) => cover.wideDist - MICRO_STRAFE;

/**
 * ctx: { scene, look, player, world: { boxes, meshes }, input, M, weapons, armorRules, audio, eye(): Vector3, rng? }
 * now는 일시정지 중에 멈추는 세션 시계(초)다.
 */
export function createSession({ mode, weaponId, judge, armor, settings, ctx, covers }) {
  const rng = ctx.rng ?? Math.random;
  const w = ctx.weapons[weaponId];
  const ws = createWeaponState(w, rng);
  const records = [];
  const history = [];
  const recoil = { pitch: 0, yaw: 0 };
  let kills = 0;
  let phase = 'waiting';
  let phaseUntil = 0.4;
  let bot = null;
  let highlight = null;
  let dot = null;
  let dotHeld = 0;
  let debug = false;

  const playerFeet = () => ({ ...ctx.player.pos });

  function clearLine(target) {
    const eye = ctx.eye();
    const r = castShot({ origin: eye, dir: target.clone().sub(eye).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] });
    return r.distance >= target.distanceTo(eye) - 0.05;
  }

  // 엄폐물 지점이 지금 플레이어 눈에서 보이는지(와이드 피킹 위치의 머리 기준)
  function coverVisible(c) {
    const d = c.dirs[0];
    return clearLine(new THREE.Vector3(c.hide.x + d.x * c.wideDist, c.hide.y + HEAD_Y, c.hide.z + d.z * c.wideDist));
  }

  function newRecord(cover) {
    return {
      mode, coverId: cover.id, d: null, h: null, kind: null, peekIndex: 0,
      firstSeenAt: null, killedAt: null, placementErr: null, distM: null,
      shots: [], firstShot: null, failed: false,
      hp: 100, armor: judge === 'kill' ? armor : 0,
    };
  }

  function spawnBot(cover, now) {
    const model = createBotModel(settings.bot.colors);
    model.setDebug(debug);
    model.root.userData.role = 'bot';
    ctx.scene.add(model.root);
    const peek = mode === 'peek' ? createPeekBot(cover, settings.peek, ctx.M, rng) : null;
    bot = { cover, model, peek, record: newRecord(cover), seenThisPeek: 0, microT: 0, offset: microCenter(cover) };
    history.push({ ...classifyBucket(playerFeet(), cover.hide, settings.buckets), coverId: cover.id });
    placeBot(0, now);
    if (mode === 'micro') markSeen(now);
  }

  function removeBot() {
    if (!bot) return;
    ctx.scene.remove(bot.model.root);
    bot.model.dispose();
    bot = null;
  }

  function placeBot(dt, now) {
    const { cover, model } = bot;
    let vel = 0;
    if (bot.peek) {
      stepPeekBot(bot.peek, dt);
      vel = bot.peek.vel;
    } else if (settings.micro.botStrafe) {
      bot.microT += dt;
      const prev = bot.offset;
      bot.offset = microCenter(cover) + MICRO_STRAFE * Math.sin((bot.microT * 2 * Math.PI) / 0.9);
      vel = dt > 0 ? (bot.offset - prev) / dt : 0;
    }
    const d = cover.dirs[bot.peek ? bot.peek.dirIndex : 0];
    const pos = bot.peek
      ? botWorldPos(bot.peek, cover)
      : { x: cover.hide.x + d.x * bot.offset, y: cover.hide.y, z: cover.hide.z + d.z * bot.offset };
    model.root.position.set(pos.x, pos.y, pos.z);
    const eye = ctx.eye();
    const ry = Math.atan2(eye.x - pos.x, eye.z - pos.z);
    model.root.rotation.y = ry;
    // 모델의 오른쪽(+x) 방향 기준 옆걸음 속도
    const strafeVel = vel * (d.x * Math.cos(ry) - d.z * Math.sin(ry));
    model.setPose({ strafeVel, crouch: 0, t: now });
  }

  function markSeen(now) {
    const rec = bot.record;
    if (rec.firstSeenAt !== null) return;
    rec.firstSeenAt = now;
    const b = classifyBucket(playerFeet(), bot.model.root.position, settings.buckets);
    rec.d = b.d;
    rec.h = b.h;
    rec.distM = ctx.eye().distanceTo(bot.model.headWorldPos());
  }

  // 모드 1: 매 피킹에서 머리가 처음 보인 순간의 조준 오차를 잰다(봇마다 첫 값 저장).
  function trackVisibility(now) {
    const p = bot.peek;
    if (!p || p.state === 'hidden' || bot.seenThisPeek === p.peekCount) return;
    if (!clearLine(bot.model.headWorldPos())) return;
    bot.seenThisPeek = p.peekCount;
    markSeen(now);
    if (bot.record.placementErr === null) {
      const to = bot.model.headWorldPos().sub(ctx.eye()).normalize();
      bot.record.placementErr = angleOffsets(ctx.look.forward(), to);
    }
  }

  function finishBot(now) {
    disposeMesh(highlight);
    highlight = null;
    const { hp, armor: _armor, ...rec } = bot.record;
    records.push(rec);
    kills++;
    removeBot();
    phase = kills >= settings.session.botCount ? 'done' : 'waiting';
    phaseUntil = now + between(rng, settings.session.nextBotDelay);
  }

  function killBot(now) {
    const rec = bot.record;
    rec.killedAt = now;
    rec.kind = bot.peek ? bot.peek.kind : 'short';
    rec.peekIndex = bot.peek ? bot.peek.peekCount : 1;
    finishBot(now);
    ctx.audio.kill();
  }

  function disposeMesh(m) {
    if (!m) return;
    ctx.scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }

  function showHighlight(cover) {
    highlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, cover.edge.y - cover.hide.y, 0.08),
      new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0.9 }),
    );
    highlight.position.set(cover.edge.x, (cover.edge.y + cover.hide.y) / 2, cover.edge.z);
    highlight.userData.role = 'coverHighlight';
    ctx.scene.add(highlight);
  }

  // 모드 2: 봇이 나타날 머리 위치에서 offsetDeg만큼 떨어진 곳에 시작 점을 띄운다.
  function placeDot(cover) {
    const d = cover.dirs[0];
    const c = microCenter(cover);
    const head = new THREE.Vector3(cover.hide.x + d.x * c, cover.hide.y + HEAD_Y, cover.hide.z + d.z * c);
    const eye = ctx.eye();
    const toHead = head.clone().sub(eye);
    const dist = toHead.length();
    const off = sampleRing(toHead.normalize(), rad(between(rng, settings.micro.offsetDeg)), rng() * Math.PI * 2);
    const radius = Math.max(MICRO_DOT_RADIUS, dist * 0.004);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe14d' }));
    mesh.position.copy(eye.clone().add(off.multiplyScalar(dist)));
    mesh.userData.role = 'microDot';
    ctx.scene.add(mesh);
    dot = { mesh, cover, radiusDeg: Math.max(0.35, (Math.atan(radius / dist) * 180) / Math.PI) };
    dotHeld = 0;
  }

  function nextTarget(now) {
    const cover = pickCover(covers, playerFeet(), history, settings.buckets, coverVisible, rng);
    if (mode === 'micro') {
      placeDot(cover);
      phase = 'dot';
    } else if (settings.session.coverHighlight) {
      showHighlight(cover);
      spawnBot(cover, now);
      phase = 'highlight';
      phaseUntil = now + HIGHLIGHT_TIME;
    } else {
      spawnBot(cover, now);
      phase = 'active';
    }
  }

  function handleFire(now) {
    const input = ctx.input;
    if (input.keys.has(settings.keys.reload)) startReload(ws, w, now);
    const spread = currentSpreadDeg(ws, w, stanceOf(ctx.player, ctx.M), now);
    if (!tryFire(ws, w, now, input.mouseDown, input.pressedThisFrame)) return;

    ctx.audio.shot();
    const eye = ctx.eye();
    const f = ctx.look.forward();
    const hitboxes = bot ? bot.model.hitboxes : [];
    const res = castShot({ origin: eye, dir: v3(sampleSpread(f, spread, rng)), worldMeshes: ctx.world.meshes, botHitboxes: hitboxes });
    const aimed = aimedPart(eye, v3(f), hitboxes, ctx.world.meshes);

    // 반동: 화면을 올리고, 쏘지 않으면 천천히 돌아온다.
    ctx.look.pitch += rad(ws.lastRecoil.pitch);
    ctx.look.yaw += rad(ws.lastRecoil.yaw);
    recoil.pitch += ws.lastRecoil.pitch;
    recoil.yaw += ws.lastRecoil.yaw;

    if (!bot) return;
    const rec = bot.record;
    // 숨어 있는 봇에게 쏜 발(벽에 맞음)은 처치 시간 측정을 시작하지 않는다.
    if (rec.firstSeenAt === null && res.part) markSeen(now);
    const b = classifyBucket(playerFeet(), bot.model.root.position, settings.buckets);
    const distM = eye.distanceTo(bot.model.headWorldPos());
    const damage = res.part ? damageAt(w, res.part, distM) : 0;
    rec.shots.push({
      t: now, weapon: weaponId, part: res.part, aimedPart: aimed,
      moving: speedFraction(ctx.player, ctx.M) > ctx.M.accurateSpeedFraction,
      distM, d: b.d, h: b.h, damage,
    });
    if (rec.shots.length === 1) rec.firstShot = res.part;

    if (res.part === 'head') ctx.audio.head();
    else if (res.part) ctx.audio.body();

    if (judge === 'head') {
      if (res.part === 'head') killBot(now);
    } else if (res.part) {
      const t = applyDamage({ hp: rec.hp, armor: rec.armor }, damage, ctx.armorRules);
      rec.hp = t.hp;
      rec.armor = t.armor;
      if (t.killed) killBot(now);
    }
  }

  function recoverRecoil(dt, now) {
    if (now - ws.lastShotAt < (1 / w.fireRate) * 1.5) return;
    const step = w.recoil.recoverRate * dt;
    const p = Math.min(recoil.pitch, step);
    ctx.look.pitch -= rad(p);
    recoil.pitch -= p;
    const y = Math.sign(recoil.yaw) * Math.min(Math.abs(recoil.yaw), step);
    ctx.look.yaw -= rad(y);
    recoil.yaw -= y;
  }

  return {
    update(dt, now) {
      updateWeapon(ws, w, now);
      if (phase === 'done') return;
      recoverRecoil(dt, now);

      if (phase === 'waiting' && now >= phaseUntil) nextTarget(now);
      if (phase === 'highlight' && now >= phaseUntil) {
        disposeMesh(highlight);
        highlight = null;
        phase = 'active';
      }
      if (phase === 'dot') {
        const o = angleOffsets(ctx.look.forward(), dot.mesh.position.clone().sub(ctx.eye()).normalize());
        dotHeld = Math.hypot(o.v, o.h) <= dot.radiusDeg ? dotHeld + dt : 0;
        if (dotHeld >= settings.micro.holdTime) {
          const cover = dot.cover;
          disposeMesh(dot.mesh);
          dot = null;
          spawnBot(cover, now);
          phase = 'active';
        }
      }
      if (bot) {
        // 엄폐물 표시 중에는 봇이 숨은 채로 기다린다.
        placeBot(phase === 'highlight' ? 0 : dt, now);
        if (phase !== 'highlight') trackVisibility(now);
      }
      handleFire(now);
      if (mode === 'micro' && bot && phase === 'active' && now - bot.record.firstSeenAt > settings.micro.timeLimit) {
        bot.record.failed = true;
        finishBot(now);
      }
    },
    isDone: () => phase === 'done',
    records: () => records.slice(),
    hud() {
      const shots = records.flatMap((r) => r.shots).concat(bot ? bot.record.shots : []);
      const heads = shots.filter((s) => s.part === 'head').length;
      return {
        botsLeft: settings.session.botCount - kills,
        headRate: shots.length ? heads / shots.length : null,
        ammo: ws.ammo,
        magazine: w.magazine,
        reloading: ws.reloadingUntil !== null,
        weapon: w.name,
      };
    },
    setDebug(on) {
      debug = on;
      bot?.model.setDebug(on);
    },
    dispose() {
      removeBot();
      disposeMesh(highlight);
      highlight = null;
      if (dot) disposeMesh(dot.mesh);
      dot = null;
    },
  };
}

// dir 둘레에서 각도 angle, 방위 phi 만큼 돌린 방향
function sampleRing(dir, angle, phi) {
  const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, helper).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u);
  return dir
    .clone()
    .multiplyScalar(Math.cos(angle))
    .add(u.multiplyScalar(Math.cos(phi) * Math.sin(angle)))
    .add(v.multiplyScalar(Math.sin(phi) * Math.sin(angle)))
    .normalize();
}
