import { pct, sec, deg } from './format.js';

const DIST = ['가까움 (~15m)', '중간 (15–30m)', '멂 (30–50m)'];
const HEIGHT = ['아래', '같은 높이', '위'];
const MODE_NAME = { peek: '피킹 대응', micro: '미세 조정' };

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

  screen.innerHTML = `<div class="card">
    <h1 class="title">결과</h1>
    <p class="sub">${MODE_NAME[meta.mode]} · ${meta.weaponName} · ${meta.judge === 'kill' ? `처치 판정 (방어구 ${meta.armor})` : '헤드 전용'} · 봇 ${s.bots}명</p>
    <div class="hero"><div><div class="big">${pct(s.firstShotHeadRate)}</div><div class="cap">첫 발 헤드샷 비율</div></div></div>
    <div class="stats">
      ${stat('전체 헤드샷', pct(s.headRate))}
      ${stat('몸 / 다리', `${pct(s.bodyRate)} / ${pct(s.legsRate)}`)}
      ${stat('평균 처치 시간', sec(s.avgKillTime))}
      ${meta.mode === 'peek' ? stat('배치 오차 (세로 / 가로)', placement) : stat('실패', `${s.failed}명`)}
      ${stat('퍼짐 때문에 빗나간 발', `${s.spreadMisses}발`)}
      ${stat('움직이며 쏜 발', `${s.movingShots}발`)}
      ${meta.judge === 'kill' ? stat('원탭 비율', pct(s.oneTapRate)) : ''}
    </div>
    <div class="label">거리 × 높이 (헤드샷 비율 · 평균 처치 시간, 빨간 칸이 가장 약한 상황)</div>
    <div class="grid3">${grid}</div>
    ${split}
    <div class="actions"><button class="btn primary" id="retry">다시 하기</button><button class="btn" id="menu">메인으로</button></div>
    <p class="note" id="saved"></p>
  </div>`;
  screen.querySelector('#retry').onclick = onRetry;
  screen.querySelector('#menu').onclick = onMenu;
  root.replaceChildren(screen);
  return { setSaved: (text) => (screen.querySelector('#saved').textContent = text) };
}
