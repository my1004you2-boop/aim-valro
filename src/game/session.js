import * as THREE from 'three';
import { createWeaponState, tryFire, updateWeapon, startReload, currentSpreadDeg } from '../core/weapon.js';
import { damageAt, applyDamage } from '../core/damage.js';
import { sampleSpread } from '../core/spread.js';
import { createPeekBot, stepPeekBot, botWorldPos } from '../core/peek.js';
import { pickCover } from '../core/spawn.js';
import { coversFor, standable } from '../core/covers.js';
import { classifyBucket } from '../core/buckets.js';
import { angleOffsets, stanceOf } from '../core/aim.js';
import { speedFraction } from '../core/physics.js';
import { castShot, castMelee, aimedPart } from './shooting.js';
import { createBotModel } from './botModel.js';
import { createEffects } from './effects.js';
import { createBrakeTracker, stepBrake, classifyShot } from '../core/braking.js';

const HIGHLIGHT_TIME = 0.6;
const HEAD_Y = 1.6;
const MICRO_DOT_RADIUS = 0.06;
const rad = (d) => (d * Math.PI) / 180;
const between = (rng, [a, b]) => a + (b - a) * rng();
const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);
// 모드 2 봇은 숨지 않는다: 몸이 완전히 드러나는 위치를 중심으로 ±0.4m A/D 한다.
const MICRO_STRAFE = 0.4;
const microCenter = (cover) => cover.wideDist - MICRO_STRAFE;
// 연속 처치: 직전 처치 후 이 시간 안에 다시 잡으면 처치음 단계가 오른다(최대 5).
const STREAK_WINDOW = 4;
const MAX_STREAK = 5;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
// 발소리: 걷는 속도보다 빠르게 움직이면 0.3초마다 한 걸음
const STEP_SPEED = 3;
const STEP_INTERVAL = 0.3;
// 봇 반격 난이도(근사값): 반응 시간(초), 명중률, 맞았을 때 머리일 확률, 초당 발사 수
export const BOT_LEVELS = {
  easy: { reaction: [0.45, 0.7], accuracy: 0.3, headChance: 0.1, fireRate: 3 },
  normal: { reaction: [0.3, 0.45], accuracy: 0.5, headChance: 0.2, fireRate: 4 },
  hard: { reaction: [0.18, 0.28], accuracy: 0.7, headChance: 0.35, fireRate: 5 },
};
const PLAYER_HP = 100;
const PLAYER_ARMOR = 50; // 중량 방어구를 산 상태로 본다
const DEATH_TIME = 1.5;
// 플릭 모드: 봇이 설 수 있는 큰 바닥(건물 지붕 제외)
const FLOOR_MIN_AREA = 30;
const FLOOR_MAX_Y = 2;
const FLICK_TRIES = 400;
// 각 확인 모드: 숨은 자리에서 벽 끝 쪽으로 이만큼까지 나와 각을 잡고 선다. 봇끼리는 이만큼 떨어진다.
const CLEAR_HOLD = [0, 0.4];
const CLEAR_SPACING = 4;
// 빗나간 발을 어느 봇의 기록으로 볼지: 조준선에서 이 각도 안에 있는, 이미 보인 봇
const MISS_ATTRIBUTE_DEG = 15;
// 브레이킹 연습: 최고 속도의 이 비율보다 빠르게 달리고 있어야 신호가 쌓인다.
const STRAFE_RUN_FRACTION = 0.6;

// 총구 위치: 화면 오른쪽 아래, 눈 앞 0.4m (총 모델이 없어서 궤적 시작점으로만 쓴다)
function muzzleOf(eye, forward) {
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward);
  return eye.clone().addScaledVector(forward, 0.4).addScaledVector(right, 0.12).addScaledVector(up, -0.1);
}

/**
 * ctx: { scene, look, player, world: { boxes, meshes }, input, M, weapons, knife, armorRules, audio, eye(): Vector3, muzzle?, rng? }
 * mode: 'peek' | 'micro' | 'flick' | 'clear' | 'strafe'
 * loadout: { primary, secondary } — 1번 주무기, 2번 보조무기, 3번 칼
 * botFire: 'off' | 'easy' | 'normal' | 'hard'
 * brakeJudge: true면 이동 중(데드존 밖, 최고 속도 27.5% 초과)에 쏜 발은 맞아도 무효
 * now는 일시정지 중에 멈추는 세션 시계(초)다.
 */
export function createSession({ mode, loadout, judge, armor, botFire = 'off', brakeJudge = false, settings, ctx, walls }) {
  const rng = ctx.rng ?? Math.random;
  const slots = [
    { id: loadout.primary, w: ctx.weapons[loadout.primary] },
    { id: loadout.secondary, w: ctx.weapons[loadout.secondary] },
    { id: 'knife', w: ctx.knife },
  ].map((s) => ({ ...s, ws: s.w.melee ? null : createWeaponState(s.w, rng) }));
  let active = 0;
  let equipUntil = 0;
  const melee = { nextAt: 0, lastAt: -Infinity };
  const cur = () => slots[active];
  const botWeapon = ctx.weapons.vandal ?? slots[0].w;
  const level = BOT_LEVELS[botFire] ?? null;
  const me = { hp: PLAYER_HP, armor: PLAYER_ARMOR, hurtAt: -Infinity };
  const floors = ctx.world.boxes.filter((b) => b.max.y <= FLOOR_MAX_Y && (b.max.x - b.min.x) * (b.max.z - b.min.z) >= FLOOR_MIN_AREA);
  const timeLimit = { micro: settings.micro.timeLimit, flick: settings.flick.timeLimit, strafe: settings.strafe.timeLimit }[mode] ?? null;
  const brake = createBrakeTracker();
  let lastShot = null;
  // 플릭 전환은 조준 전환만 연습하므로 탄창이 줄지 않고 재장전도 없다.
  const infiniteAmmo = mode === 'flick';
  const records = [];
  const history = [];
  const recoil = { pitch: 0, yaw: 0 };
  let kills = 0;
  let phase = 'waiting';
  let phaseUntil = 0.4;
  // 피킹/미세/플릭 모드는 봇이 한 번에 하나, 각 확인 모드는 한 무리(웨이브)가 함께 선다.
  let bots = [];
  let wave = 0;
  let waveStart = 0;
  let highlight = null;
  let dot = null;
  let dotHeld = 0;
  let debug = false;
  let streak = 0;
  let lastKillAt = -Infinity;
  let lastNow = 0;
  const fx = createEffects(ctx.scene, settings);

  const playerFeet = () => ({ ...ctx.player.pos });
  const botOf = (obj) => (obj ? bots.find((b) => b.model.hitboxes.includes(obj)) ?? null : null);

  function clearLine(target) {
    const eye = ctx.eye();
    const r = castShot({ origin: eye, dir: target.clone().sub(eye).normalize(), worldMeshes: ctx.world.meshes, botHitboxes: [] });
    return r.distance >= target.distanceTo(eye) - 0.05;
  }

  // (x, z)에 선 봇이 지금 플레이어 눈에서 완전히 가려지는지(머리, 가슴 기준)
  function hiddenAt(p) {
    return [HEAD_Y, 1.1].every((y) => !clearLine(new THREE.Vector3(p.x, p.y + y, p.z)));
  }
  const coverHides = (c) => hiddenAt(c.hide);

  // 엄폐물 지점이 지금 플레이어 눈에서 보이는지(와이드 피킹 위치의 머리 기준)
  function coverVisible(c) {
    const d = c.dirs[0];
    return clearLine(new THREE.Vector3(c.hide.x + d.x * c.wideDist, c.hide.y + HEAD_Y, c.hide.z + d.z * c.wideDist));
  }

  function newRecord(cover) {
    return {
      mode, coverId: cover.id, d: null, h: null, kind: null, peekIndex: 0,
      firstSeenAt: null, killedAt: null, placementErr: null, distM: null,
      shots: [], firstShot: null, failed: false, died: false, flickDeg: null, flickResidual: null, wave: null,
      cueAt: null, reaction: null,
      hp: 100, armor: judge === 'kill' ? armor : 0,
    };
  }

  function spawnBot(cover, now) {
    const model = createBotModel(settings.bot.colors);
    model.setDebug(debug);
    model.root.userData.role = 'bot';
    ctx.scene.add(model.root);
    const peek = mode === 'peek' ? createPeekBot(cover, settings.peek, ctx.M, rng) : null;
    const b = {
      cover, model, peek, record: newRecord(cover), seenThisPeek: 0, microT: 0,
      offset: ['flick', 'clear', 'strafe'].includes(mode) ? 0 : microCenter(cover), lastStepAt: -Infinity, seeSince: null, nextShotAt: 0,
      marker: null, runFor: 0, cueNeed: between(rng, settings.strafe.moveTime),
    };
    bots.push(b);
    history.push({ ...classifyBucket(playerFeet(), cover.hide, settings.buckets), coverId: cover.id, wall: cover.wall });
    placeBot(b, 0, now);
    if (mode === 'micro' || mode === 'flick') markSeen(b, now);
    if (mode === 'flick') {
      const o = angleOffsets(ctx.look.forward(), model.headWorldPos().sub(ctx.eye()).normalize());
      b.flickFrom = o;
      b.record.flickDeg = Math.hypot(o.v, o.h);
    }
    if (mode === 'clear') b.record.wave = wave;
    return b;
  }

  function removeBot(b) {
    ctx.scene.remove(b.model.root);
    if (b.marker) {
      b.marker.geometry.dispose();
      b.marker.material.dispose();
    }
    b.model.dispose();
    bots = bots.filter((x) => x !== b);
  }

  function placeBot(b, dt, now) {
    const { cover, model } = b;
    let vel = 0;
    if (b.peek) {
      stepPeekBot(b.peek, dt);
      vel = b.peek.vel;
    } else if (mode === 'micro' && settings.micro.botStrafe) {
      b.microT += dt;
      const prev = b.offset;
      b.offset = microCenter(cover) + MICRO_STRAFE * Math.sin((b.microT * 2 * Math.PI) / 0.9);
      vel = dt > 0 ? (b.offset - prev) / dt : 0;
    }
    const d = cover.dirs[b.peek ? b.peek.dirIndex : 0];
    const pos = b.peek
      ? botWorldPos(b.peek, cover)
      : { x: cover.hide.x + d.x * b.offset, y: cover.hide.y, z: cover.hide.z + d.z * b.offset };
    model.root.position.set(pos.x, pos.y, pos.z);
    if (settings.audio.footsteps && Math.abs(vel) >= STEP_SPEED && now - b.lastStepAt >= STEP_INTERVAL) {
      b.lastStepAt = now;
      ctx.audio.step(pos);
    }
    const eye = ctx.eye();
    const ry = Math.atan2(eye.x - pos.x, eye.z - pos.z);
    model.root.rotation.y = ry;
    // 모델의 오른쪽(+x) 방향 기준 옆걸음 속도
    const strafeVel = vel * (d.x * Math.cos(ry) - d.z * Math.sin(ry));
    model.setPose({ strafeVel, crouch: 0, t: now });
  }

  function markSeen(b, now) {
    const rec = b.record;
    if (rec.firstSeenAt !== null) return;
    rec.firstSeenAt = now;
    const k = classifyBucket(playerFeet(), b.model.root.position, settings.buckets);
    rec.d = k.d;
    rec.h = k.h;
    rec.distM = ctx.eye().distanceTo(b.model.headWorldPos());
  }

  function notePlacement(b) {
    if (b.record.placementErr !== null) return;
    const to = b.model.headWorldPos().sub(ctx.eye()).normalize();
    b.record.placementErr = angleOffsets(ctx.look.forward(), to);
  }

  // 머리가 처음 보인 순간의 조준 오차를 잰다. 피킹 모드는 매 피킹마다 보지만 기록은 봇마다 첫 값만 남긴다.
  function trackVisibility(b, now) {
    if (mode === 'clear') {
      if (b.record.firstSeenAt !== null || !clearLine(b.model.headWorldPos())) return;
      markSeen(b, now);
      notePlacement(b);
      return;
    }
    const p = b.peek;
    if (!p || p.state === 'hidden' || b.seenThisPeek === p.peekCount) return;
    if (!clearLine(b.model.headWorldPos())) return;
    b.seenThisPeek = p.peekCount;
    markSeen(b, now);
    notePlacement(b);
  }

  function finishBot(b, now) {
    if (mode !== 'clear') {
      disposeMesh(highlight);
      highlight = null;
    }
    const { hp, armor: _armor, ...rec } = b.record;
    records.push(rec);
    kills++;
    removeBot(b);
    if (bots.length) return;
    phase = kills >= settings.session.botCount ? 'done' : 'waiting';
    phaseUntil = now + between(rng, settings.session.nextBotDelay);
  }

  function killBot(b, now) {
    const rec = b.record;
    rec.killedAt = now;
    rec.kind = b.peek ? b.peek.kind : 'short';
    rec.peekIndex = b.peek ? b.peek.peekCount : 1;
    finishBot(b, now);
    streak = now - lastKillAt <= STREAK_WINDOW ? Math.min(MAX_STREAK, streak + 1) : 1;
    lastKillAt = now;
    ctx.audio.kill(streak);
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

  // 지금 조준 방향에서 angleDeg만큼 떨어진, 머리가 보이는 바닥 위 지점(플릭 전환, 브레이킹 연습)
  function pickVisibleSpot({ angleDeg, distance }) {
    const eye = ctx.eye();
    const f = ctx.look.forward();
    const [a0, a1] = angleDeg;
    const [d0, d1] = distance;
    const areas = floors.map((b) => (b.max.x - b.min.x) * (b.max.z - b.min.z));
    const total = areas.reduce((a, b) => a + b, 0);
    for (let i = 0; i < FLICK_TRIES; i++) {
      let r = rng() * total;
      const b = floors[areas.findIndex((a) => (r -= a) < 0)] ?? floors[0];
      const p = { x: b.min.x + 0.5 + rng() * (b.max.x - b.min.x - 1), y: b.max.y, z: b.min.z + 0.5 + rng() * (b.max.z - b.min.z - 1) };
      const head = new THREE.Vector3(p.x, p.y + HEAD_Y, p.z);
      const dist = head.distanceTo(eye);
      if (dist < d0 || dist > d1) continue;
      const o = angleOffsets(f, head.clone().sub(eye).normalize());
      const deg = Math.hypot(o.v, o.h);
      if (deg < a0 || deg > a1) continue;
      if (!standable(p, p.y, ctx.world.boxes) || !clearLine(head)) continue;
      return p;
    }
    return null;
  }

  // 모드 B: 지금 위치에서 안 보이는 벽 뒤 자리들에 봇 한 무리를 세운다(벽마다 한 명, 서로 떨어지게).
  function spawnWave(now) {
    const n = Math.min(settings.clear.waveSize, settings.session.botCount - kills);
    const spots = [];
    for (const c of coversFor(walls, ctx.world.boxes, playerFeet())) {
      const hold = between(rng, CLEAR_HOLD);
      const d = c.dirs[0];
      const p = { x: c.hide.x + d.x * hold, y: c.hide.y, z: c.hide.z + d.z * hold };
      if (standable(p, p.y, ctx.world.boxes) && hiddenAt(p)) spots.push({ c, p, r: rng() });
    }
    spots.sort((a, b) => a.r - b.r);
    const chosen = [];
    for (const s of spots) {
      if (chosen.length >= n) break;
      if (chosen.some((x) => x.c.wall === s.c.wall || Math.hypot(x.p.x - s.p.x, x.p.z - s.p.z) < CLEAR_SPACING)) continue;
      chosen.push(s);
    }
    if (!chosen.length) {
      phaseUntil = now + 0.5;
      return;
    }
    wave++;
    waveStart = now;
    for (const { c, p } of chosen) spawnBot({ ...c, hide: p }, now);
    phase = 'active';
  }

  // 봇 머리 위 표식(벽 너머로도 보인다)
  function addMarker(b, role, color) {
    if (b.marker) return;
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }),
    );
    m.position.set(0, 2.25, 0);
    m.renderOrder = 10;
    m.userData.role = role;
    b.model.root.add(m);
    b.marker = m;
  }

  // 오래 못 찾은 봇
  function reveal(b) {
    addMarker(b, 'reveal', '#00e5ff');
    b.record.revealed = true;
  }

  // 브레이킹 연습: 일정 시간 달리면 신호(초록 표식 + 소리). 이때부터 시간을 잰다.
  function updateStrafe(b, dt, now) {
    if (b.record.cueAt !== null) return;
    b.runFor = brake.speed > STRAFE_RUN_FRACTION ? b.runFor + dt : 0;
    if (b.runFor < b.cueNeed) return;
    b.record.cueAt = now;
    markSeen(b, now);
    addMarker(b, 'cue', '#3ddc97');
    ctx.audio.cue();
  }

  // 누른 이동 키를 월드 방향으로(브레이킹 판정용)
  function wishWorld() {
    const k = settings.keys;
    const has = (c) => ctx.input.keys.has(c);
    const x = (has(k.right) ? 1 : 0) - (has(k.left) ? 1 : 0);
    const z = (has(k.forward) ? 1 : 0) - (has(k.back) ? 1 : 0);
    const f = ctx.look.forward();
    const l = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / l;
    const fz = f.z / l;
    return { x: -fz * x + fx * z, z: fx * x + fz * z };
  }

  function nextTarget(now) {
    if (mode === 'clear') return spawnWave(now);
    if (mode === 'flick' || mode === 'strafe') {
      const p = pickVisibleSpot(settings[mode]);
      if (!p) {
        phaseUntil = now + 0.2;
        return;
      }
      spawnBot({ id: mode, wall: null, hide: p, dirs: [{ x: 1, z: 0 }], shortDist: 0, wideDist: 0, edge: p }, now);
      phase = 'active';
      return;
    }
    // 숨는 지점은 지금 플레이어 위치 기준으로 벽 반대편에 잡고, 실제로 가려지는 곳만 쓴다.
    const all = coversFor(walls, ctx.world.boxes, playerFeet());
    const hidden = all.filter(coverHides);
    const cover = pickCover(hidden.length ? hidden : all, playerFeet(), history, settings.buckets, coverVisible, rng);
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

  function swapTo(i, now) {
    if (i === active) return;
    // 바꾸면 재장전은 취소된다(탄은 채워지지 않는다).
    if (cur().ws) cur().ws.reloadingUntil = null;
    active = i;
    equipUntil = now + cur().w.equipTime;
  }

  // 빗나간 발을 기록할 봇: 혼자 있으면 그 봇, 여럿이면 조준선 가까이 있는 이미 보인 봇
  function missTarget(eye, aimDir) {
    if (mode !== 'clear') return bots[0] ?? null;
    let best = null;
    let bestDeg = MISS_ATTRIBUTE_DEG;
    for (const b of bots) {
      if (b.record.firstSeenAt === null) continue;
      const o = angleOffsets(aimDir, b.model.headWorldPos().sub(eye).normalize());
      const deg = Math.hypot(o.v, o.h);
      if (deg < bestDeg) {
        best = b;
        bestDeg = deg;
      }
    }
    return best;
  }

  // 맞힌 결과를 봇 기록과 판정에 반영한다(총, 칼 공통).
  function registerHit(b, now, res, damage, aimed, weaponId, eye, aimDir, shotBrake = null) {
    const rec = b.record;
    // 브레이킹 연습: 신호 전에는 맞지 않는다.
    if (mode === 'strafe' && rec.cueAt === null) return;
    if (mode === 'strafe' && rec.shots.length === 0) rec.reaction = now - rec.cueAt;
    const voided = !!shotBrake?.voided;
    // 플릭 첫 발: 남은 오차를 처음 떨어져 있던 방향으로 투영한다(+ 덜 감, - 지나침).
    if (mode === 'flick' && rec.shots.length === 0 && aimDir) {
      const left = angleOffsets(aimDir, b.model.headWorldPos().sub(eye).normalize());
      const from = b.flickFrom;
      const len = Math.hypot(from.v, from.h) || 1;
      rec.flickResidual = (left.v * from.v + left.h * from.h) / len;
    }
    // 숨어 있는 봇에게 쏜 발(벽에 맞음)은 처치 시간 측정을 시작하지 않는다.
    if (rec.firstSeenAt === null && res.part) markSeen(b, now);
    const k = classifyBucket(playerFeet(), b.model.root.position, settings.buckets);
    const distM = eye.distanceTo(b.model.headWorldPos());
    rec.shots.push({
      t: now, weapon: weaponId, part: res.part, aimedPart: aimed,
      moving: speedFraction(ctx.player, ctx.M) > ctx.M.accurateSpeedFraction,
      distM, d: k.d, h: k.h, damage: voided ? 0 : damage,
      brake: shotBrake, voided,
    });
    if (rec.shots.length === 1) rec.firstShot = voided ? null : res.part;

    // 브레이킹 판정: 이동 중에 쏜 발은 맞아도 무효
    if (voided) return;
    if (res.part === 'head') ctx.audio.head();
    else if (res.part) ctx.audio.body();

    if (judge === 'head') {
      if (res.part === 'head') killBot(b, now);
    } else if (res.part) {
      const t = applyDamage({ hp: rec.hp, armor: rec.armor }, damage, ctx.armorRules);
      rec.hp = t.hp;
      rec.armor = t.armor;
      if (t.killed) killBot(b, now);
    }
  }

  // 칼: 왼쪽 클릭 가벼운 베기, 오른쪽 클릭 무거운 베기. 부위 배율 없음.
  function handleMelee(now) {
    const input = ctx.input;
    if (now < equipUntil - 1e-9 || now < melee.nextAt - 1e-9) return;
    const heavy = input.rightDown;
    if (!heavy && !input.mouseDown && !input.pressedThisFrame) return;
    const k = cur().w;
    const atk = heavy ? k.heavy : k.light;
    melee.nextAt = now + atk.interval;
    melee.lastAt = now;
    ctx.audio.swing();
    const eye = ctx.eye();
    const f = v3(ctx.look.forward());
    const hitboxes = bots.flatMap((b) => b.model.hitboxes);
    const res = castMelee({ origin: eye, dir: f, range: k.range, worldMeshes: ctx.world.meshes, botHitboxes: hitboxes });
    if (res.point) {
      if (res.part) fx.spark(res.point, res.part, now);
      else fx.impact(res.point, res.normal, now);
    }
    const hit = botOf(res.object);
    const b = classifyShot(brake, now, ctx.M);
    lastShot = { ...b, voided: false, at: now };
    if (hit && res.part) registerHit(hit, now, res, atk.damage, res.part, 'knife', eye, f, lastShot);
  }

  function handleFire(now) {
    const input = ctx.input;
    const k = settings.keys;
    [k.slot1, k.slot2, k.slot3].forEach((code, i) => input.keys.has(code) && swapTo(i, now));
    if (cur().w.melee) return handleMelee(now);
    const { w, ws, id: weaponId } = cur();
    if (!infiniteAmmo && input.keys.has(k.reload)) startReload(ws, w, now);
    if (now < equipUntil - 1e-9) return;
    const spread = currentSpreadDeg(ws, w, stanceOf(ctx.player, ctx.M), now);
    const fired = tryFire(ws, w, now, input.mouseDown, input.pressedThisFrame);
    if (infiniteAmmo) {
      ws.ammo = w.magazine;
      ws.reloadingUntil = null;
    }
    if (!fired) return;

    ctx.audio.shot(w.sound);
    const sb = classifyShot(brake, now, ctx.M);
    lastShot = { ...sb, voided: brakeJudge && !sb.accurate, at: now };
    const eye = ctx.eye();
    const f = ctx.look.forward();
    const hitboxes = bots.flatMap((b) => b.model.hitboxes);
    const shotDir = v3(sampleSpread(f, spread, rng));
    const res = castShot({ origin: eye, dir: shotDir, worldMeshes: ctx.world.meshes, botHitboxes: hitboxes });
    const end = res.point ?? eye.clone().addScaledVector(shotDir, 100);
    fx.tracer(ctx.muzzle?.() ?? muzzleOf(eye, v3(f)), end, now);
    if (res.point) {
      if (res.part) fx.spark(res.point, res.part, now);
      else fx.impact(res.point, res.normal, now);
    }
    const aimed = aimedPart(eye, v3(f), hitboxes, ctx.world.meshes);

    // 반동: 화면을 올리고, 쏘지 않으면 천천히 돌아온다.
    ctx.look.pitch += rad(ws.lastRecoil.pitch);
    ctx.look.yaw += rad(ws.lastRecoil.yaw);
    recoil.pitch += ws.lastRecoil.pitch;
    recoil.yaw += ws.lastRecoil.yaw;

    const target = botOf(res.object) ?? missTarget(eye, v3(f));
    if (!target) return;
    const damage = res.part ? damageAt(w, res.part, eye.distanceTo(target.model.headWorldPos())) : 0;
    registerHit(target, now, res, damage, aimed, weaponId, eye, v3(f), lastShot);
  }

  // 봇 반격: 플레이어가 보이면 반응 시간 뒤부터 쏜다. 명중은 거리와 플레이어 이동에 따라 떨어진다.
  function botAttack(b, now) {
    const head = b.model.headWorldPos();
    const visible = !(b.peek && b.peek.state === 'hidden') && clearLine(head);
    if (!visible) {
      b.seeSince = null;
      return;
    }
    if (b.seeSince === null) {
      b.seeSince = now;
      b.nextShotAt = now + between(rng, level.reaction);
    }
    if (now < b.nextShotAt - 1e-9) return;
    b.nextShotAt = now + 1 / level.fireRate;
    const eye = ctx.eye();
    const dist = eye.distanceTo(head);
    const moving = speedFraction(ctx.player, ctx.M) > ctx.M.accurateSpeedFraction;
    const p = level.accuracy * Math.max(0.3, 1 - Math.max(0, dist - 10) / 60) * (moving ? 0.6 : 1);
    const part = rng() < p ? (rng() < level.headChance ? 'head' : 'body') : null;
    const muzzle = head.clone().addScaledVector(eye.clone().sub(head).normalize(), 0.45).add(new THREE.Vector3(0, -0.3, 0));
    const miss = () => (rng() - 0.5) * 1.6;
    const target = part
      ? eye.clone().add(new THREE.Vector3(0, part === 'head' ? 0 : -0.45, 0))
      : eye.clone().add(new THREE.Vector3(miss(), miss(), miss()));
    fx.tracer(muzzle, target, now);
    ctx.audio.enemyShot(muzzle);
    if (!part) return;
    const t = applyDamage({ hp: me.hp, armor: me.armor }, damageAt(botWeapon, part, dist), ctx.armorRules);
    me.hp = t.hp;
    me.armor = t.armor;
    me.hurtAt = now;
    ctx.audio.hurt(part);
    if (t.killed) die(b, now);
  }

  // 플레이어 사망: 나를 잡은 봇과의 대결은 진 것으로 기록하고 잠시 뒤 이어서 한다.
  function die(b, now) {
    b.record.died = true;
    b.record.failed = true;
    b.record.kind = b.peek ? b.peek.kind : 'short';
    finishBot(b, now);
    ctx.audio.death();
    if (phase !== 'done') {
      phase = 'dead';
      phaseUntil = now + DEATH_TIME;
    }
  }

  function recoverRecoil(dt, now) {
    const { w, ws } = cur();
    if (!ws) return;
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
      lastNow = now;
      if (cur().ws) updateWeapon(cur().ws, cur().w, now);
      fx.update(now);
      if (phase === 'done') return;
      recoverRecoil(dt, now);
      if (phase === 'dead') {
        if (now < phaseUntil) return;
        me.hp = PLAYER_HP;
        me.armor = PLAYER_ARMOR;
        // 각 확인 모드는 남은 봇과 이어서 싸운다.
        phase = bots.length ? 'active' : 'waiting';
      }

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
      for (const b of bots) {
        // 엄폐물 표시 중에는 봇이 숨은 채로 기다린다.
        placeBot(b, phase === 'highlight' ? 0 : dt, now);
        if (phase !== 'highlight') trackVisibility(b, now);
      }
      stepBrake(brake, { vel: ctx.player.vel, wish: wishWorld(), now }, ctx.M);
      if (mode === 'strafe' && bots[0] && phase === 'active') updateStrafe(bots[0], dt, now);
      if (mode === 'clear' && phase === 'active' && now - waveStart >= settings.clear.revealAfter) {
        bots.filter((b) => b.record.firstSeenAt === null).forEach(reveal);
      }
      handleFire(now);
      if (level && phase === 'active') {
        for (const b of [...bots]) {
          botAttack(b, now);
          if (phase !== 'active') break;
        }
      }
      const b = bots[0];
      if (timeLimit !== null && b && phase === 'active' && b.record.firstSeenAt !== null && now - b.record.firstSeenAt > timeLimit) {
        b.record.failed = true;
        finishBot(b, now);
      }
    },
    // 무기 교환: 주무기/보조무기 칸을 새 총(탄창 가득)으로 바꾼다. 손에 든 칸이면 다시 꺼낸다.
    buy(slot, id, now) {
      const i = slot === 'primary' ? 0 : 1;
      const w = ctx.weapons[id];
      if (!w) return;
      slots[i] = { id, w, ws: createWeaponState(w, rng) };
      if (i === active) {
        equipUntil = now + w.equipTime;
        recoil.pitch = 0;
        recoil.yaw = 0;
      }
    },
    loadout: () => ({ primary: slots[0].id, secondary: slots[1].id }),
    isDone: () => phase === 'done',
    records: () => records.slice(),
    hud() {
      const shots = records.flatMap((r) => r.shots).concat(bots.flatMap((b) => b.record.shots));
      const heads = shots.filter((s) => s.part === 'head').length;
      const { w, ws, id } = cur();
      return {
        botsLeft: settings.session.botCount - kills,
        headRate: shots.length ? heads / shots.length : null,
        slot: active + 1,
        slots: slots.map((s, i) => ({ key: i + 1, name: s.w.name, active: i === active })),
        weaponId: id,
        melee: !ws,
        moveSpeedMul: w.moveSpeedMul,
        ammo: ws ? ws.ammo : null,
        magazine: ws ? w.magazine : null,
        reloading: !!ws && ws.reloadingUntil !== null,
        reloadProgress: !ws || ws.reloadingUntil === null ? null : Math.min(1, Math.max(0, 1 - (ws.reloadingUntil - lastNow) / w.reloadTime)),
        shotAt: ws ? ws.lastShotAt : melee.lastAt,
        weapon: w.name,
        infiniteAmmo,
        botFire: !!level,
        hp: me.hp,
        armor: me.armor,
        hurtAgo: lastNow - me.hurtAt,
        dead: phase === 'dead',
        wave: mode === 'clear' ? { index: wave, left: bots.length } : null,
        lastShot,
        speed: brake.speed,
        deadzone: ctx.M.accurateSpeedFraction,
        sinceShot: lastShot ? lastNow - lastShot.at : Infinity,
        brakeJudge,
        strafe: mode === 'strafe' ? { cue: !!bots[0] && bots[0].record.cueAt !== null, running: brake.speed > STRAFE_RUN_FRACTION } : null,
      };
    },
    setDebug(on) {
      debug = on;
      bots.forEach((b) => b.model.setDebug(on));
    },
    dispose() {
      [...bots].forEach(removeBot);
      disposeMesh(highlight);
      highlight = null;
      if (dot) disposeMesh(dot.mesh);
      dot = null;
      fx.clear();
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
