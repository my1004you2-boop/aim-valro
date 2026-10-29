const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const rate = (n, total) => (total ? n / total : 0);
const killTime = (b) => (b.killedAt == null ? null : b.killedAt - b.firstSeenAt);

function group(bots) {
  const shots = bots.flatMap((b) => b.shots);
  const killed = bots.filter((b) => b.killedAt != null);
  return {
    n: bots.length,
    headRate: shots.length ? rate(shots.filter((s) => s.part === 'head').length, shots.length) : null,
    avgKillTime: mean(killed.map(killTime)),
  };
}

export function summarize(bots, headSizeDeg) {
  const shots = bots.flatMap((b) => b.shots);
  const killed = bots.filter((b) => b.killedAt != null);
  const placed = bots.filter((b) => b.placementErr);
  const count = (part) => shots.filter((s) => s.part === part).length;

  const grid = [0, 1, 2].map((d) => [0, 1, 2].map((h) => group(bots.filter((b) => b.d === d && b.h === h))));
  let weakest = null;
  for (let d = 0; d < 3; d++) {
    for (let h = 0; h < 3; h++) {
      const c = grid[d][h];
      if (!c.n || c.headRate === null) continue;
      const w = weakest && grid[weakest.d][weakest.h];
      if (!w || c.headRate < w.headRate || (c.headRate === w.headRate && (c.avgKillTime ?? Infinity) > (w.avgKillTime ?? Infinity))) {
        weakest = { d, h };
      }
    }
  }

  return {
    bots: bots.length,
    firstShotHeadRate: rate(bots.filter((b) => b.firstShot === 'head').length, bots.length),
    headRate: rate(count('head'), shots.length),
    bodyRate: rate(count('body'), shots.length),
    legsRate: rate(count('legs'), shots.length),
    avgKillTime: mean(killed.map(killTime)),
    avgPlacement: placed.length
      ? { v: mean(placed.map((b) => Math.abs(b.placementErr.v))), h: mean(placed.map((b) => Math.abs(b.placementErr.h))) }
      : null,
    avgPlacementHeads: placed.length
      ? {
          v: mean(placed.map((b) => Math.abs(b.placementErr.v) / headSizeDeg(b.distM))),
          h: mean(placed.map((b) => Math.abs(b.placementErr.h) / headSizeDeg(b.distM))),
        }
      : null,
    spreadMisses: shots.filter((s) => s.aimedPart === 'head' && s.part !== 'head').length,
    movingShots: shots.filter((s) => s.moving).length,
    oneTapRate: rate(killed.filter((b) => b.shots.length === 1).length, killed.length),
    failed: bots.filter((b) => b.failed).length,
    grid,
    weakest,
    peekSplit: {
      short: group(bots.filter((b) => b.kind === 'short')),
      wide: group(bots.filter((b) => b.kind === 'wide')),
    },
  };
}
