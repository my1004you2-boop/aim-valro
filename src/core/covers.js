// 엄폐 벽 + 플레이어 위치 → 봇이 숨을 지점과 피킹 방향.
// 벽은 축 정렬 판이다: { id, x, y(바닥 높이), z, hx, hz(반폭), h(높이) }. 두께 방향이 법선이다.
// 숨는 지점은 항상 플레이어 반대쪽 면에 두고, 벽의 양 끝(왼쪽/오른쪽)을 각각 후보로 낸다.
export const PEEK_DIST = { short: 0.6, wide: 2.2 };
const BACK_GAP = 0.55; // 벽 뒷면에서 봇 중심까지
const END_INSET = 0.45; // 벽 끝에서 안쪽으로 들어간 숨는 위치
const BOT_R = 0.3;
const BOT_H = 1.8;
const r3 = (v) => Math.round(v * 1000) / 1000;

const onSurface = (p, y, boxes) => boxes.some((b) => p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z && Math.abs(b.max.y - y) < 0.1);
const blocked = (p, y, boxes) =>
  boxes.some(
    (b) => b.max.y > y + 0.05 && b.min.y < y + BOT_H &&
      p.x + BOT_R > b.min.x && p.x - BOT_R < b.max.x && p.z + BOT_R > b.min.z && p.z - BOT_R < b.max.z,
  );

// 봇이 (x, z)에 높이 y로 설 수 있는지: 바닥 위이고 어떤 상자와도 겹치지 않는다.
export const standable = (p, y, boxes) => onSurface(p, y, boxes) && !blocked(p, y, boxes);

export function coversFor(walls, boxes, feet) {
  const out = [];
  for (const w of walls) {
    const alongX = w.hx >= w.hz;
    const n = alongX ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const l = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const half = alongX ? w.hx : w.hz;
    const thick = alongX ? w.hz : w.hx;
    const playerSide = (feet.x - w.x) * n.x + (feet.z - w.z) * n.z >= 0 ? 1 : -1;
    const back = thick + BACK_GAP;
    for (const s of [-1, 1]) {
      const along = s * (half - END_INSET);
      const hide = { x: r3(w.x - n.x * playerSide * back + l.x * along), y: w.y, z: r3(w.z - n.z * playerSide * back + l.z * along) };
      const dir = { x: l.x * s, z: l.z * s };
      const ok = [0, PEEK_DIST.short, PEEK_DIST.wide].every((d) => {
        const p = { x: hide.x + dir.x * d, z: hide.z + dir.z * d };
        return onSurface(p, w.y, boxes) && !blocked(p, w.y, boxes);
      });
      if (!ok) continue;
      out.push({
        id: `${w.id}${s > 0 ? '+' : '-'}`,
        wall: w.id,
        hide,
        dirs: [dir],
        shortDist: PEEK_DIST.short,
        wideDist: PEEK_DIST.wide,
        edge: { x: r3(w.x + l.x * half * s), y: w.y + w.h, z: r3(w.z + l.z * half * s) },
      });
    }
  }
  return out;
}
