import { classifyBucket } from './buckets.js';

// 보이는 지점 중에서 지금까지 가장 적게 나온 (거리, 높이) 칸을 우선으로 고른다.
// 직전에 쓴 벽(같은 벽의 반대쪽 끝 포함)은 고르지 않는다.
export function pickCover(covers, playerFeet, history, cfg, visible, rng = Math.random) {
  const last = history.length ? history[history.length - 1] : null;
  const lastWall = last ? (last.wall ?? last.coverId) : null;
  const wallOf = (c) => c.wall ?? c.id;
  const counts = new Map();
  for (const { d, h } of history) counts.set(`${d}:${h}`, (counts.get(`${d}:${h}`) ?? 0) + 1);

  const candidates = covers
    .filter((c) => wallOf(c) !== lastWall && visible(c))
    .map((c) => ({ c, b: classifyBucket(playerFeet, c.hide, cfg) }))
    .filter(({ b }) => b.d !== null && cfg.enabled.distance[b.d] && cfg.enabled.height[b.h]);
  if (!candidates.length) {
    const fallback = covers.filter((c) => wallOf(c) !== lastWall);
    return fallback[Math.floor(rng() * fallback.length)] ?? covers[0];
  }

  const score = ({ b }) => counts.get(`${b.d}:${b.h}`) ?? 0;
  const min = Math.min(...candidates.map(score));
  const best = candidates.filter((x) => score(x) === min);
  return best[Math.floor(rng() * best.length)].c;
}
