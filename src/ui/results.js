import { pct, sec, deg } from './format.js';
import { BRAKE_LABEL } from './hud.js';

const DIST = ['가까움 (~15m)', '중간 (15–30m)', '멂 (30–50m)'];
const HEIGHT = ['아래', '같은 높이', '위'];
const MODE_NAME = { peek: '피킹 대응', micro: '미세 조정', flick: '플릭 전환', clear: '각 확인', strafe: '브레이킹 연습' };
const FLICK_NAME = ['작은 플릭 (~20°)', '중간 플릭 (20–45°)', '큰 플릭 (45°~)'];

const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;

export function renderResults(root, { summary: s, meta, onRetry, onMenu }) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  const heads = s.avgPlacementHeads;
  const placement = s.avgPlacement
    ? `${deg(s.avgPlacement.v)} / ${deg(s.avgPlacement.h)}<br/><span class="note">머리 ${heads.v.toFixed(1)}개 / ${heads.h.toFixed(1)}개</span>`
    : '—';

  let grid = `<div></div>${HEIGHT.map((h) => `<div class="hdr">${h}</div>`).join('')}`;
  for (let d = 0; d < 3; d++) {
    grid += `<div class="rowh">${DIST[d]}</div>`;
    for (let h = 0; h < 3; h++) {
      const c = s.grid[d][h];
      const weak = s.weakest && s.weakest.d === d && s.weakest.h === h;
      grid += c.n
        ? `<div class="cell${weak ? ' weak' : ''}"><div class="hr">${pct(c.headRate)}</div><div class="t">${c.n}명 · ${sec(c.avgKillTime)}</div></div>`
        : `<div class="cell empty"><div class="hr">—</div><div class="t">기록 없음</div></div>`;
    }
  }

  const split = meta.mode === 'peek'
    ? `<div class="label">숏 피킹 vs 와이드 피킹</div><div class="split">
        ${stat(`숏 피킹 (${s.peekSplit.short.n}명)`, `${pct(s.peekSplit.short.headRate)} · ${sec(s.peekSplit.short.avgKillTime)}`)}
        ${stat(`와이드 피킹 (${s.peekSplit.wide.n}명)`, `${pct(s.peekSplit.wide.headRate)} · ${sec(s.peekSplit.wide.avgKillTime)}`)}</div>`
    : '';

  // 플릭: 크기별 첫 발 헤드 비율과 처치 시간, 첫 발이 지나쳤는지/덜 갔는지
  const fl = s.flick;
  const flick = meta.mode === 'flick' && fl
    ? `<div class="label">플릭 크기별 (첫 발 헤드샷 · 평균 처치 시간) · 평균 플릭 ${deg(fl.avgFlickDeg)}</div><div class="stats">
        ${fl.bins.map((b, i) => stat(`${FLICK_NAME[i]} · ${b.n}명`, b.n ? `${pct(b.firstShotHeadRate)} · ${sec(b.avgKillTime)}` : '—')).join('')}
        ${stat('첫 발 방향', `지나침 ${fl.overshoot} · 덜 감 ${fl.undershoot}`)}</div>`
    : '';

  // 각 확인: 발견 순간 조준선이 멀리 있던 봇(각을 안 보고 있었음), 표식으로 찾은 봇
  const cl = s.clear;
  const clear = meta.mode === 'clear' && cl
    ? `<div class="label">각 확인 (평균 처치 시간은 봇이 처음 보인 순간부터 잰 값)</div><div class="stats">
        ${stat('웨이브', `${cl.waves}번`)}
        ${stat('안 보던 각에서 나온 봇', `${cl.offGuard}명`)}
        ${stat('표식으로 찾은 봇', `${cl.revealed}명`)}</div>`
    : '';

  // 브레이킹: 모든 모드. 톡과 만세는 따로 보여 준다.
  const ms = (v) => (v == null ? '—' : `${Math.round(v)}ms`);
  const brakeStyle = (title, st) => `<div class="label">${title}</div><div class="stats">
        ${stat('쏜 발', `${st.count}발`)}
        ${stat('멈추는 데 평균', ms(st.avgStopMs))}
        ${stat('멈추고 쏘기까지 평균', ms(st.avgShotMs))}
        ${stat('헤드 비율', st.headRate == null ? '—' : pct(st.headRate))}</div>`;
  const bk = s.brake;
  const brake = bk
    ? `<div class="label">브레이킹 (쏜 순간의 이동 상태)${meta.brakeJudge ? ' · 판정 켬: 이동 중에 쏜 발은 무효' : ''}</div><div class="stats">
        ${['still', 'moving', 'overheld'].map((k) => stat(BRAKE_LABEL[k], `${bk.counts[k]}발`)).join('')}
        ${stat('움직인 뒤 정확하게 쏜 비율', pct(bk.afterMoveAccurate))}
        ${meta.brakeJudge ? stat('무효 처리된 발', `${bk.voided}발`) : ''}</div>
      ${brakeStyle('톡 브레이킹 (반대 키로 멈춤)', bk.styles.braked)}
      ${brakeStyle('만세 브레이킹 (키를 떼서 멈춤)', bk.styles.coasted)}`
    : '';
  const sf = s.strafe;
  const strafe = meta.mode === 'strafe' && sf
    ? `<div class="label">브레이킹 연습</div><div class="stats">
        ${stat('신호 → 첫 발 평균', sec(sf.avgReaction))}
        ${stat('시간 안에 못 맞힌 판', `${sf.failed}번`)}</div>`
    : '';

  screen.innerHTML = `<div class="card">
    <h1 class="title">결과</h1>
    <p class="sub">${MODE_NAME[meta.mode]} · ${meta.weaponName} · ${meta.judge === 'kill' ? `처치 판정 (방어구 ${meta.armor})` : '헤드 전용'} · 봇 ${s.bots}명</p>
    <div class="hero"><div><div class="big">${pct(s.firstShotHeadRate)}</div><div class="cap">첫 발 헤드샷 비율</div></div></div>
    <div class="stats">
      ${stat('전체 헤드샷', pct(s.headRate))}
      ${stat('몸 / 다리', `${pct(s.bodyRate)} / ${pct(s.legsRate)}`)}
      ${stat('평균 처치 시간', sec(s.avgKillTime))}
      ${meta.mode === 'peek' || meta.mode === 'clear' ? stat('배치 오차 (세로 / 가로)', placement) : stat('실패', `${s.failed}명`)}
      ${stat('퍼짐 때문에 빗나간 발', `${s.spreadMisses}발`)}
      ${stat('움직이며 쏜 발', `${s.movingShots}발`)}
      ${meta.judge === 'kill' ? stat('원탭 비율', pct(s.oneTapRate)) : ''}
      ${meta.botFire && meta.botFire !== 'off' ? stat('봇에게 당한 횟수', `${s.deaths}번`) : ''}
    </div>
    <div class="label">거리 × 높이 (헤드샷 비율 · 평균 처치 시간, 빨간 칸이 가장 약한 상황)</div>
    <div class="grid3">${grid}</div>
    ${split}
    ${flick}
    ${clear}
    ${strafe}
    ${brake}
    <div class="actions"><button class="btn primary" id="retry">다시 하기</button><button class="btn" id="menu">메인으로</button></div>
    <p class="note" id="saved"></p>
  </div>`;
  screen.querySelector('#retry').onclick = onRetry;
  screen.querySelector('#menu').onclick = onMenu;
  root.replaceChildren(screen);
  return { setSaved: (text) => (screen.querySelector('#saved').textContent = text) };
}
