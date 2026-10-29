import { classifyBucket } from './buckets.js';

// 보이는 지점 중에서 지금까지 가장 적게 나온 (거리, 높이) 칸을 우선으로 고른다.
export function pickCover(covers, playerFeet, history, cfg, visible, rng = Math.random) {
  const lastId = history.length ? history[history.length - 1].coverId : null;
  const counts = new Map();
  for (const { d, h } of history) counts.set(`${d}:${h}`, (counts.get(`${d}:${h}`) ?? 0) + 1);

  const candidates = covers
    .filter((c) => c.id !== lastId && visible(c))
    .map((c) => ({ c, b: classifyBucket(playerFeet, c.hide, cfg) }))
    .filter(({ b }) => b.d !== null && cfg.enabled.distance[b.d] && cfg.enabled.height[b.h]);
  if (!candidates.length) {
    const fallback = covers.filter((c) => c.id !== lastId);
    return fallback[Math.floor(rng() * fallback.length)] ?? covers[0];
  }

  const score = ({ b }) => counts.get(`${b.d}:${b.h}`) ?? 0;
  const min = Math.min(...candidates.map(score));
  const best = candidates.filter((x) => score(x) === min);
  return best[Math.floor(rng() * best.length)].c;
}
