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

// 플릭 크기 구간: 작은(<20°), 중간(20~45°), 큰(>45°)
const FLICK_BINS = [[0, 20], [20, 45], [45, Infinity]];

function flickSummary(bots) {
  const f = bots.filter((b) => b.flickDeg != null);
  if (!f.length) return null;
  return {
    bins: FLICK_BINS.map(([a, b]) => {
      const g = f.filter((x) => x.flickDeg >= a && x.flickDeg < b);
      return { ...group(g), from: a, to: b, firstShotHeadRate: g.length ? rate(g.filter((x) => x.firstShot === 'head').length, g.length) : null };
    }),
    overshoot: f.filter((b) => b.flickResidual != null && b.flickResidual < 0).length,
    undershoot: f.filter((b) => b.flickResidual != null && b.flickResidual > 0).length,
    avgFlickDeg: mean(f.map((b) => b.flickDeg)),
  };
}

// 각 확인: 발견 순간 조준선이 이 각도보다 멀었으면 그 각을 안 보고 있던 것으로 본다.
const OFF_GUARD_DEG = 30;

function clearSummary(bots) {
  const c = bots.filter((b) => b.wave != null);
  if (!c.length) return null;
  return {
    waves: new Set(c.map((b) => b.wave)).size,
    offGuard: c.filter((b) => b.placementErr && Math.hypot(b.placementErr.v, b.placementErr.h) > OFF_GUARD_DEG).length,
    revealed: c.filter((b) => b.revealed).length,
  };
}

// 브레이킹: 쏜 발마다 이동 상태 분류(still/braked/coasted/moving/overheld)
const BRAKE_KINDS = ['still', 'braked', 'coasted', 'moving', 'overheld'];

// 멈춘 방식별(톡 = braked, 만세 = coasted): 멈추는 데 걸린 시간, 멈추고 쏘기까지, 헤드 비율
function brakeStyle(s) {
  const ms = (key) => mean(s.map((x) => x.brake[key]).filter((v) => v != null));
  return {
    count: s.length,
    avgStopMs: ms('stopMs'),
    avgShotMs: ms('sinceStopMs'),
    headRate: s.length ? rate(s.filter((x) => x.part === 'head').length, s.length) : null,
  };
}

function brakeSummary(shots) {
  const s = shots.filter((x) => x.brake);
  if (!s.length) return null;
  const counts = Object.fromEntries(BRAKE_KINDS.map((k) => [k, s.filter((x) => x.brake.kind === k).length]));
  const afterMove = s.filter((x) => x.brake.kind !== 'still');
  return {
    counts,
    styles: Object.fromEntries(['braked', 'coasted'].map((k) => [k, brakeStyle(s.filter((x) => x.brake.kind === k))])),
    afterMoveAccurate: afterMove.length ? rate(afterMove.filter((x) => x.brake.accurate).length, afterMove.length) : null,
    voided: s.filter((x) => x.voided).length,
  };
}

// 브레이킹 연습: 신호부터 첫 발까지 반응 시간, 시간 안에 못 맞힌 판
function strafeSummary(bots) {
  const r = bots.filter((b) => b.cueAt != null);
  if (!r.length) return null;
  return {
    avgReaction: mean(r.filter((b) => b.reaction != null).map((b) => b.reaction)),
    failed: r.filter((b) => b.failed).length,
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
    deaths: bots.filter((b) => b.died).length,
    flick: flickSummary(bots),
    clear: clearSummary(bots),
    brake: brakeSummary(shots),
    strafe: strafeSummary(bots),
    grid,
    weakest,
    peekSplit: {
      short: group(bots.filter((b) => b.kind === 'short')),
      wide: group(bots.filter((b) => b.kind === 'wide')),
    },
  };
}
