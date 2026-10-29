// 플레이어 이동: Quake 계열 가속/마찰 + AABB 충돌. 1/240초 단위로 나눠 계산한다.
const SUBSTEP = 1 / 240;
const EPS = 1e-4;

export function createPlayer(spawn) {
  return { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, onGround: true, crouchT: 0 };
}

const lerp = (a, b, t) => a + (b - a) * t;
export const eyeHeight = (p, M) => lerp(M.eyeStand, M.eyeCrouch, p.crouchT);
const bodyHeight = (p, M) => lerp(M.height, M.crouchHeight, p.crouchT);

export function speedFraction(p, M) {
  return Math.hypot(p.vel.x, p.vel.z) / M.runSpeed;
}

function playerBox(pos, r, h) {
  return { min: { x: pos.x - r, y: pos.y, z: pos.z - r }, max: { x: pos.x + r, y: pos.y + h, z: pos.z + r } };
}

function overlaps(a, b) {
  return (
    a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS &&
    a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS &&
    a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS
  );
}

function blocked(pos, r, h, boxes) {
  const pb = playerBox(pos, r, h);
  return boxes.some((b) => overlaps(pb, b));
}

function xzOverlap(pos, r, b) {
  return pos.x - r < b.max.x - EPS && pos.x + r > b.min.x + EPS && pos.z - r < b.max.z - EPS && pos.z + r > b.min.z + EPS;
}

// 세로 이동은 지나간 구간 안의 윗면/아랫면을 찾아 정확히 멈춘다(가라앉지 않음).
function moveVertical(p, delta, boxes, M, h) {
  const y0 = p.pos.y;
  let y1 = y0 + delta;
  for (const b of boxes) {
    if (!xzOverlap(p.pos, M.radius, b)) continue;
    if (delta <= 0 && b.max.y <= y0 + EPS && b.max.y > y1) {
      y1 = b.max.y;
      p.onGround = true;
      p.vel.y = 0;
    } else if (delta > 0 && b.min.y >= y0 + h - EPS && b.min.y < y1 + h) {
      y1 = b.min.y - h;
      p.vel.y = 0;
    }
  }
  p.pos.y = y1;
}

function moveAxis(p, axis, delta, boxes, M, h, grounded) {
  if (delta === 0) return;
  p.pos[axis] += delta;
  for (const b of boxes) {
    const pb = playerBox(p.pos, M.radius, h);
    if (!overlaps(pb, b)) continue;
    // 낮은 턱은 걸어서 올라간다.
    const rise = b.max.y - p.pos.y;
    if (grounded && rise > 0 && rise <= M.stepHeight + EPS && !blocked({ ...p.pos, y: b.max.y }, M.radius, h, boxes)) {
      p.pos.y = b.max.y;
      continue;
    }
    p.pos[axis] = delta > 0 ? b.min[axis] - M.radius : b.max[axis] + M.radius;
    p.vel[axis] = 0;
  }
}

function accelerate(vel, dirX, dirZ, wishSpeed, accel, dt) {
  const current = vel.x * dirX + vel.z * dirZ;
  const add = wishSpeed - current;
  if (add <= 0) return;
  const step = Math.min(accel * dt * wishSpeed, add);
  vel.x += step * dirX;
  vel.z += step * dirZ;
}

function substep(p, input, boxes, dt, M, weaponSpeedMul) {
  // 앉기: 천장이 막혀 있으면 일어서지 않는다.
  const target = input.crouch ? 1 : 0;
  const rate = dt / M.crouchTransition;
  let next = target > p.crouchT ? Math.min(target, p.crouchT + rate) : Math.max(target, p.crouchT - rate);
  if (next < p.crouchT && blocked(p.pos, M.radius, lerp(M.height, M.crouchHeight, next), boxes)) next = p.crouchT;
  p.crouchT = next;

  const fwdX = -Math.sin(input.yaw);
  const fwdZ = -Math.cos(input.yaw);
  let wx = fwdX * input.wishZ + -fwdZ * input.wishX;
  let wz = fwdZ * input.wishZ + fwdX * input.wishX;
  const len = Math.hypot(wx, wz);
  if (len > 0) {
    wx /= len;
    wz /= len;
  }

  let wishSpeed = len > 0 ? M.runSpeed * weaponSpeedMul : 0;
  if (input.walk) wishSpeed *= M.walkMul;
  wishSpeed *= lerp(1, M.crouchMul, p.crouchT);

  if (p.onGround) {
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (speed > 0) {
      const drop = Math.max(speed, M.stopSpeed) * M.friction * dt;
      const k = Math.max(0, speed - drop) / speed;
      p.vel.x *= k;
      p.vel.z *= k;
    }
    if (len > 0) accelerate(p.vel, wx, wz, wishSpeed, M.accel, dt);
    if (input.jump) {
      p.vel.y = M.jumpVelocity;
      p.onGround = false;
    }
  } else if (len > 0) {
    accelerate(p.vel, wx, wz, wishSpeed, M.accel * M.airControl, dt);
  }

  p.vel.y -= M.gravity * dt;
  const h = bodyHeight(p, M);
  const grounded = p.onGround;
  moveAxis(p, 'x', p.vel.x * dt, boxes, M, h, grounded);
  moveAxis(p, 'z', p.vel.z * dt, boxes, M, h, grounded);
  p.onGround = false;
  moveVertical(p, p.vel.y * dt, boxes, M, h);
}

export function stepPlayer(p, input, boxes, dt, M, weaponSpeedMul = 1) {
  let left = Math.min(dt, 0.5);
  while (left > 1e-9) {
    const d = Math.min(SUBSTEP, left);
    substep(p, input, boxes, d, M, weaponSpeedMul);
    left -= d;
  }
}
