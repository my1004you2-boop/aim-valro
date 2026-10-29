// 사격장 맵 생성기: node tools/gen-range.mjs → data/range.json
// 왼쪽은 3m 낮은 구덩이, 오른쪽은 3m 높은 발판, 가운데는 같은 높이 통로.
import fs from 'node:fs';

const boxes = [];
const box = (x0, y0, z0, x1, y1, z1, color) =>
  boxes.push({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, ...(color ? { color } : {}) });

const FLOOR = '#474d59';
const WALL = '#5f6779';
const COVER = '#8a93a6';
const STEP = '#5a6170';

// 바닥
box(-3, -4, -55, 7, 0, 8, FLOOR); // 가운데 통로(구덩이 벽 포함)
box(-40, -4, -55, -3, -3, 8, FLOOR); // 왼쪽 구덩이 바닥
box(7, -1, -4, 40, 0, 8, FLOOR); // 오른쪽 앞 바닥
box(7, -1, -55, 40, 3, -4, FLOOR); // 오른쪽 2층 발판

// 바깥 벽
box(-41, -4, -56, 41, 8, -55, WALL);
box(-41, -4, 8, 41, 8, 9, WALL);
box(-41, -4, -55, -40, 8, 8, WALL);
box(40, -4, -55, 41, 8, 8, WALL);

// 계단: 구덩이로 내려가는 계단(-x 방향), 발판으로 올라가는 계단(-z 방향). 0.3m씩 10칸.
for (let i = 0; i < 10; i++) {
  box(-3 - 0.4 * (i + 1), -3, 2, -3 - 0.4 * i, -0.3 * (i + 1), 5, STEP);
  box(7, 0, -0.4 * (i + 1), 10, 0.3 * (i + 1), -0.4 * i, STEP);
}

// 엄폐물: [벽 중심 x, 바닥 높이, z, 피킹 방향(+1/-1)]
const SPOTS = [
  // 같은 높이
  [0.5, 0, -9, -1], [3, 0, -6, 1], [1, 0, -20, -1], [3, 0, -26, 1], [1, 0, -38, -1], [2, 0, -46, 1],
  // 아래(구덩이)
  [-9, -3, -4, -1], [-7.5, -3, -8, 1], [-16, -3, -18, -1], [-25, -3, -12, 1], [-20, -3, -36, -1], [-30, -3, -30, 1],
  // 위(발판)
  [8.5, 3, -6.5, 1], [8, 3, -8.5, 1], [17, 3, -17, 1], [24, 3, -12, -1], [20, 3, -35, 1], [28, 3, -36, -1],
];

const HALF_W = 1.2;
const THICK = 0.4;
const WALL_H = 2.6;
const r3 = (v) => Math.round(v * 1000) / 1000;

const covers = SPOTS.map(([x, y, z, side], i) => {
  // 벽은 시작 위치를 향하는 주축에 수직인 축 정렬 벽이다.
  // d: 벽에서 시작 위치 쪽 방향, l: 벽을 따라가는 옆 방향(둘 다 축 정렬)
  const alongX = Math.abs(z - 2) >= Math.abs(x);
  const d = alongX ? { x: 0, z: Math.sign(2 - z) } : { x: Math.sign(-x), z: 0 };
  const l = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const hw = { x: alongX ? HALF_W : THICK / 2, z: alongX ? THICK / 2 : HALF_W };
  box(r3(x - hw.x), y, r3(z - hw.z), r3(x + hw.x), y + WALL_H, r3(z + hw.z), COVER);
  const hideAlong = side * (HALF_W - 0.45);
  return {
    id: `c${i + 1}`,
    hide: { x: r3(x - d.x * 0.75 + l.x * hideAlong), y, z: r3(z - d.z * 0.75 + l.z * hideAlong) },
    dirs: [{ x: l.x * side, z: l.z * side }],
    shortDist: 0.6,
    wideDist: 2.2,
    edge: { x: r3(x + l.x * HALF_W * side), y: y + WALL_H, z: r3(z + l.z * HALF_W * side) },
  };
});

const range = { spawn: { x: 0, y: 0, z: 2, yaw: 0 }, boxes, covers };
fs.writeFileSync(new URL('../data/range.json', import.meta.url), `${JSON.stringify(range, null, 1)}\n`);
console.log(`boxes ${boxes.length}, covers ${covers.length}`);
