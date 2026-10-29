import { speedFraction } from './physics.js';
import { BOT_HEAD_WIDTH } from './constants.js';

const deg = (r) => (r * 180) / Math.PI;
const yawOf = (d) => Math.atan2(-d.x, -d.z);
const pitchOf = (d) => Math.asin(Math.max(-1, Math.min(1, d.y / Math.hypot(d.x, d.y, d.z))));

// 조준 방향과 목표 방향의 세로(v)·가로(h) 각도 차이(도). 양수 = 목표가 위/왼쪽.
export function angleOffsets(forward, toTarget) {
  let h = deg(yawOf(toTarget) - yawOf(forward));
  h = ((((h + 180) % 360) + 360) % 360) - 180;
  return { v: deg(pitchOf(toTarget) - pitchOf(forward)), h };
}

// 발로란트: 최고 속도의 30% 이하에서 정확하다.
export function stanceOf(p, M) {
  if (!p.onGround) return 'air';
  const f = speedFraction(p, M);
  if (f > 0.6) return 'run';
  if (f > M.accurateSpeedFraction) return 'walk';
  return p.crouchT > 0.5 ? 'crouch' : 'stand';
}

export function headSizeDeg(distM) {
  return deg(2 * Math.atan(BOT_HEAD_WIDTH / 2 / Math.max(distM, 0.1)));
}
