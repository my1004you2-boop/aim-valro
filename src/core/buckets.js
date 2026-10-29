// 쏜 순간(또는 처음 보인 순간)의 실제 위치로 거리·높이 구간을 정한다.
export function classifyBucket(playerFeet, botFeet, cfg) {
  const dx = botFeet.x - playerFeet.x;
  const dy = botFeet.y - playerFeet.y;
  const dz = botFeet.z - playerFeet.z;
  const dist = Math.hypot(dx, dy, dz);
  const idx = cfg.distance.findIndex(([, hi]) => dist <= hi);
  const h = dy < -cfg.heightEdge ? 0 : dy > cfg.heightEdge ? 2 : 1;
  return { d: idx === -1 ? null : idx, h };
}
