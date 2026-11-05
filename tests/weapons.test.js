import { test, expect } from 'vitest';
import data from '../data/weapons.json';
import M from '../data/movement.json';

// 게임 내 무기 정보 화면 수치: [달리기 m/s, 장착, 재장전, 탄창, 연사, 초탄 퍼짐, 피해량 구간 [~m, 헤드, 몸, 다리]...]
const SPEC = {
  vandal: [5.4, 1, 2.5, 25, 9.75, 0.25, [[999, 160, 40, 34]]],
  phantom: [5.4, 1, 2.5, 30, 11, 0.2, [[20, 156, 39, 33], [999, 140, 35, 29]]],
  guardian: [5.4, 1, 2.5, 12, 5.25, 0.1, [[999, 195, 65, 48]]],
  bulldog: [5.4, 1, 2.5, 24, 10, 0.3, [[999, 115, 35, 29]]],
  spectre: [5.74, 0.75, 2.25, 30, 13.33, 0.4, [[15, 78, 26, 22], [30, 66, 22, 18], [999, 60, 20, 17]]],
  stinger: [5.74, 0.75, 2.25, 20, 16, 0.65, [[15, 67, 27, 22], [999, 57, 23, 19]]],
  sheriff: [5.4, 1, 2.25, 6, 4, 0.25, [[30, 159, 55, 46], [999, 145, 50, 42]]],
  ghost: [5.74, 0.75, 1.5, 13, 6.75, 0.3, [[30, 105, 30, 25], [999, 87, 25, 21]]],
  frenzy: [5.74, 1, 1.5, 15, 10, 0.65, [[20, 78, 26, 22], [999, 63, 21, 17]]],
  ares: [5.13, 1.25, 3.25, 50, 13, 1, [[30, 75, 30, 25], [999, 70, 28, 23]]],
  odin: [5.13, 1.25, 5, 100, 12, 0.8, [[30, 95, 38, 32], [999, 77, 31, 26]]],
};

for (const [id, [run, equip, reload, mag, rate, spread, bands]] of Object.entries(SPEC)) {
  test(`${id} matches the in-game weapon sheet`, () => {
    const w = data.weapons[id];
    expect(M.runSpeed * w.moveSpeedMul).toBeCloseTo(run, 1);
    expect(w.equipTime).toBe(equip);
    expect(w.reloadTime).toBe(reload);
    expect(w.magazine).toBe(mag);
    expect(w.fireRate).toBe(rate);
    expect(w.spread.stand).toBe(spread);
    expect(w.damage).toEqual(bands.map(([maxRange, head, body, legs]) => ({ maxRange, head, body, legs })));
  });
}

test('suppressed weapons use the suppressed sound', () => {
  for (const id of ['phantom', 'spectre', 'ghost']) expect(data.weapons[id].sound).toBe('suppressed');
});
