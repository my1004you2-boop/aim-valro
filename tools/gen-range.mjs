// 사격장 맵 생성기: node tools/gen-range.mjs → data/range.json
// 독자 디자인의 작은 마을 구역(가로 36m × 세로 56m).
//   가운데: 건물 사이를 지나는 큰길(높이 0)
//   왼쪽: 1.8m 낮은 수로 골목, 오른쪽: 1.8m 높은 테라스 거리
// 시작 위치는 남쪽 끝(z=0), 북쪽(-z)을 바라본다.
import fs from 'node:fs';

const boxes = [];
const r3 = (v) => Math.round(v * 1000) / 1000;
// deco: 그리기만 하고 부딪히지 않는 장식(창문, 처마, 바닥 무늬)
const box = (x0, y0, z0, x1, y1, z1, color, extra = {}) =>
  boxes.push({ min: { x: r3(x0), y: r3(y0), z: r3(z0) }, max: { x: r3(x1), y: r3(y1), z: r3(z1) }, color, ...extra });
const deco = (x0, y0, z0, x1, y1, z1, color) => box(x0, y0, z0, x1, y1, z1, color, { deco: true });

const LOW = -1.8;
const HIGH = 1.8;
const BASE = -2.8;

const STREET = '#77736c';
const CANAL = '#5f6b6c';
const TERRACE = '#9c8f7b';
const PAVING = '#8a857c';
const PLASTER = '#cdbb9e';
const PLASTER_2 = '#b9a78b';
const PLASTER_3 = '#d8cdb8';
const TRIM = '#8b6a50';
const ROOF = '#7a4b3a';
const GLASS = '#2e3946';
const DOOR = '#5b4433';
const STEP = '#8d8273';
const CRATE = '#9a7a52';
const CRATE_2 = '#8a6b45';
const WALL = '#a89a86';

// ── 바닥 ──
box(-7, BASE, -52, 7, 0, 3, STREET); // 큰길
box(-18, BASE, -52, -7, LOW, 3, CANAL); // 수로 골목
box(7, -1, -6, 18, 0, 3, STREET); // 오른쪽 앞 광장
box(7, -1, -52, 18, HIGH, -6, TERRACE); // 테라스
// 큰길 가운데 포장 무늬
for (let z = -50; z < 2; z += 4) deco(-1.2, 0, z, 1.2, 0.012, z + 2, PAVING);
// 낭떠러지 가장자리 마감
deco(-7.15, -0.05, -52, -6.9, 0.04, 3, TRIM);
deco(6.9, HIGH - 0.05, -52, 7.15, HIGH + 0.04, -6, TRIM);

// ── 건물 ── (윗면 처마와 창문, 문을 단다)
function building(x0, y0, z0, x1, y1, z1, color, faces) {
  box(x0, y0, z0, x1, y1, z1, color);
  deco(x0 - 0.15, y1 - 0.35, z0 - 0.15, x1 + 0.15, y1, z1 + 0.15, TRIM);
  deco(x0 + 0.1, y1, z0 + 0.1, x1 - 0.1, y1 + 0.5, z1 - 0.1, ROOF);
  // faces: [면, 바닥 높이, 창문 줄 수, 문 위치들(면 방향 좌표)]
  for (const [face, floorY, rows, doors = []] of faces) {
    const alongX = face === 'n' || face === 's';
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const fixed = { n: z0, s: z1, w: x0, e: x1 }[face];
    const out = face === 's' || face === 'e' ? 1 : -1;
    const panel = (u0, u1, v0, v1, c) => {
      const f0 = fixed;
      const f1 = fixed + out * 0.08;
      if (alongX) deco(u0, v0, Math.min(f0, f1), u1, v1, Math.max(f0, f1), c);
      else deco(Math.min(f0, f1), v0, u0, Math.max(f0, f1), v1, u1, c);
    };
    const span = a1 - a0;
    const n = Math.max(1, Math.floor(span / 2.6));
    for (let r = 0; r < rows; r++) {
      const v0 = floorY + 3.1 + r * 2.8;
      if (v0 + 1.5 > y1 - 0.4) break;
      for (let i = 0; i < n; i++) {
        const c = a0 + (span * (i + 0.5)) / n;
        panel(c - 0.6, c + 0.6, v0, v0 + 1.5, GLASS);
        panel(c - 0.75, c + 0.75, v0 - 0.15, v0, TRIM);
      }
    }
    for (const d of doors) {
      panel(d - 0.8, d + 0.8, floorY, floorY + 2.5, DOOR);
      panel(d - 1.0, d + 1.0, floorY + 2.5, floorY + 2.75, TRIM);
    }
  }
}

// 바깥 건물(맵 경계)
building(-19, BASE, -55, 19, 9, -52, PLASTER_2, [['s', 0, 2, [-3.5, 3.5]]]);
building(-19, BASE, 3, 19, 9, 6, PLASTER_2, [['n', 0, 2, []]]);
building(-21, BASE, -52, -18, 8, 3, PLASTER, [['e', LOW, 2, [-20, -45]]]);
building(18, -1, -52, 21, 10, 3, PLASTER, [['w', HIGH, 2, [-10, -40]]]);
// 큰길 안쪽 건물
building(-7, BASE, -22, -3, 6.5, -14, PLASTER_3, [['e', 0, 1, [-18]], ['s', 0, 1, []], ['w', LOW, 2, []]]);
building(3, -1, -38, 7, 6.5, -29, PLASTER, [['w', 0, 1, [-33.5]], ['s', 0, 1, []]]);
building(-3, 0, -52, 3, 5.5, -48, PLASTER_3, [['s', 0, 1, [0]]]);
// 수로 골목 서쪽 건물, 테라스 동쪽 건물
building(-18, BASE, -40, -13.5, 4.5, -28, PLASTER_3, [['e', LOW, 1, [-34]], ['s', LOW, 1, []]]);
building(13.5, -1, -30, 18, 8.5, -18, PLASTER_2, [['w', HIGH, 1, [-24]], ['s', HIGH, 1, []]]);

// ── 계단 ── 0.3m씩 6칸(1.8m)
const canalStairs = (name, z0, z1) => {
  for (let i = 0; i < 6; i++) box(-7 - 0.4 * (i + 1), BASE, z0, -7 - 0.4 * i, -0.3 * (i + 1), z1, STEP, { flight: name });
};
canalStairs('canal-front', 0, 3);
canalStairs('canal-mid', -27, -24);
canalStairs('canal-back', -46, -43);
// 테라스로 올라가는 계단(-z 방향으로 오른다)
const terraceStairs = (name, x0, x1, z) => {
  for (let i = 0; i < 6; i++) box(x0, 0, z - 0.4 * (i + 1), x1, 0.3 * (i + 1), z - 0.4 * i, STEP, { flight: name });
};
terraceStairs('terrace-front', 7, 10, -3.6);
terraceStairs('terrace-mid', 5.5, 7, -9);
terraceStairs('terrace-back', 5.5, 7, -41);

// ── 엄폐물 ── 숨는 지점은 게임 중 플레이어 위치를 기준으로 src/core/covers.js가 정한다.
// [x, 바닥 높이, z, 종류]  wall: 낮은 담(2.6m), crate: 나무 상자 두 단(2.2m)
const SPOTS = [
  // 큰길
  [-2.5, 0, -7, 'wall'], [3, 0, -11, 'crate'],
  [1, 0, -19, 'wall'], [-1, 0, -26, 'crate'], [5, 0, -22, 'crate'],
  [-1, 0, -34, 'wall'], [-4.5, 0, -42, 'crate'], [1, 0, -44, 'wall'], [4, 0, -46.5, 'crate'],
  // 수로 골목
  [-12, LOW, -3, 'wall'], [-11, LOW, -7, 'crate'],
  [-11, LOW, -17, 'crate'], [-15, LOW, -23, 'wall'], [-10, LOW, -21, 'wall'], [-16, LOW, -12, 'crate'],
  [-10.5, LOW, -34, 'wall'], [-15, LOW, -45, 'wall'], [-10, LOW, -49, 'crate'], [-11.5, LOW, -40, 'crate'],
  // 테라스
  [10, HIGH, -9, 'crate'], [12.5, HIGH, -11, 'wall'],
  [11, HIGH, -22, 'wall'], [15.5, HIGH, -15, 'crate'], [10.5, HIGH, -28, 'crate'],
  [15.5, HIGH, -35, 'wall'], [11, HIGH, -42, 'crate'], [15.5, HIGH, -48, 'wall'], [9.5, HIGH, -34, 'wall'], [10, HIGH, -49, 'crate'],
];

const SPAWN = { x: 0, y: 0, z: 0, yaw: 0 };
const KINDS = {
  wall: { half: 1.2, thick: 0.22, h: 2.6 },
  crate: { half: 0.7, thick: 0.6, h: 2.2 },
};

const walls = SPOTS.map(([x, y, z, kind], i) => {
  const k = KINDS[kind];
  // 시작 위치를 향하는 주축에 수직으로 놓는다.
  const alongX = Math.abs(z - SPAWN.z) >= Math.abs(x - SPAWN.x);
  const hx = alongX ? k.half : k.thick;
  const hz = alongX ? k.thick : k.half;
  if (kind === 'wall') {
    box(x - hx, y, z - hz, x + hx, y + k.h, z + hz, WALL);
    deco(x - hx - 0.06, y + k.h, z - hz - 0.06, x + hx + 0.06, y + k.h + 0.12, z + hz + 0.06, TRIM);
  } else {
    box(x - hx, y, z - hz, x + hx, y + 1.1, z + hz, CRATE);
    box(x - hx + 0.08, y + 1.1, z - hz + 0.08, x + hx - 0.08, y + k.h, z + hz - 0.08, CRATE_2);
  }
  return { id: `w${i + 1}`, x, y, z, hx, hz, h: k.h, kind };
});

const range = { spawn: SPAWN, boxes, walls };
fs.writeFileSync(new URL('../data/range.json', import.meta.url), `${JSON.stringify(range, null, 1)}\n`);
console.log(`boxes ${boxes.length}, walls ${walls.length}`);
