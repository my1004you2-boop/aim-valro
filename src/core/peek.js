// 봇 A/D 피킹 상태 기계: hidden → out → exposed → in → hidden 을 죽을 때까지 반복한다.
const BOT_WEAPON_SPEED_MUL = 0.8; // 소총을 든 플레이어와 같은 속도
const ACCEL = 40; // m/s², 카운터 스트레이핑처럼 빠르게 서고 출발한다

const between = (rng, [a, b]) => a + (b - a) * rng();

export function createPeekBot(cover, cfg, M, rng = Math.random) {
  return {
    cover,
    cfg,
    rng,
    vmax: M.runSpeed * BOT_WEAPON_SPEED_MUL,
    offset: 0,
    vel: 0,
    state: 'hidden',
    kind: 'short',
    dirIndex: 0,
    peekCount: 0,
    exposedSince: null,
    time: 0,
    timer: between(rng, cfg.hiddenTime),
  };
}

// 목표 거리까지 가속/감속해서 정확히 멈춘다. 도착하면 true.
function moveToward(b, target, dt) {
  const dist = target - b.offset;
  const want = Math.sign(dist) * Math.min(b.vmax, Math.sqrt(2 * ACCEL * Math.abs(dist)));
  const dv = Math.max(-ACCEL * dt, Math.min(ACCEL * dt, want - b.vel));
  b.vel = Math.max(-b.vmax, Math.min(b.vmax, b.vel + dv));
  const next = b.offset + b.vel * dt;
  if (Math.abs(dist) < 0.005 || Math.sign(target - next) !== Math.sign(dist)) {
    b.offset = target;
    b.vel = 0;
    return true;
  }
  b.offset = next;
  return false;
}

export function stepPeekBot(b, dt) {
  b.time += dt;
  switch (b.state) {
    case 'hidden':
      b.timer -= dt;
      if (b.timer <= 0) {
        b.kind = b.rng() < b.cfg.wideRatio ? 'wide' : 'short';
        b.dirIndex = Math.floor(b.rng() * b.cover.dirs.length);
        b.peekCount++;
        b.exposedSince = b.time;
        b.state = 'out';
      }
      break;
    case 'out': {
      const target = b.kind === 'wide' ? b.cover.wideDist : b.cover.shortDist;
      if (moveToward(b, target, dt)) {
        // 숏 피킹은 잠깐만 머문다.
        const k = b.kind === 'short' ? 0.5 : 1;
        b.timer = between(b.rng, b.cfg.exposedTime) * k;
        b.state = 'exposed';
      }
      break;
    }
    case 'exposed':
      b.timer -= dt;
      if (b.timer <= 0) b.state = 'in';
      break;
    case 'in':
      if (moveToward(b, 0, dt)) {
        b.timer = between(b.rng, b.cfg.hiddenTime);
        b.state = 'hidden';
      }
      break;
  }
}

export function botWorldPos(b, cover) {
  const d = cover.dirs[b.dirIndex];
  return { x: cover.hide.x + d.x * b.offset, y: cover.hide.y, z: cover.hide.z + d.z * b.offset };
}
