import { cm360Label } from './format.js';
import { parseCrosshairCode, isCrosshairCode } from '../core/crosshair.js';
import { drawCrosshair } from '../game/crosshairView.js';
import { DEFAULT_SETTINGS } from '../core/settings.js';

const MODES = [
  ['peek', '피킹 대응'],
  ['micro', '미세 조정'],
  ['flick', '플릭 전환'],
  ['clear', '각 확인'],
  ['strafe', '브레이킹 연습'],
];
const BRAKE_JUDGE = [
  [false, '끔'],
  [true, '켬'],
];
const JUDGES = [
  ['head', '헤드 전용'],
  ['kill', '처치'],
];
const BOT_FIRE = [
  ['off', '끔'],
  ['easy', '쉬움'],
  ['normal', '보통'],
  ['hard', '어려움'],
];
const ARMORS = [
  [0, '없음'],
  [25, '경량 25'],
  [50, '중량 50'],
];

function seg(options, value, onPick, disabled = false) {
  const el = document.createElement('div');
  el.className = 'seg';
  for (const [v, label] of options) {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled;
    if (v === value) b.className = 'on';
    b.onclick = () => onPick(v);
    el.append(b);
  }
  return el;
}

function label(text) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  return el;
}

export function renderMenu(root, { settings, weapons, rawInput, onStart, onSettings, onQuit }) {
  const sel = { ...settings.last };
  if (weapons[sel.primary]?.slot !== 'primary') sel.primary = 'vandal';
  if (weapons[sel.secondary]?.slot !== 'secondary') sel.secondary = 'classic';
  if (!BOT_FIRE.some(([v]) => v === sel.botFire)) sel.botFire = 'off';

  const screen = document.createElement('div');
  screen.className = 'screen';
  const card = document.createElement('div');
  card.className = 'card';
  screen.append(card);

  function draw() {
    card.replaceChildren();
    const head = document.createElement('div');
    head.innerHTML = `<h1 class="title">HEADLINE <span>AIM</span></h1>
      <p class="sub">감도 ${settings.mouse.sens} · DPI ${settings.mouse.dpi} · ${cm360Label(settings.mouse.dpi, settings.mouse.sens)} · 가로 시야 ${settings.hfov}°</p>`;
    card.append(head);

    card.append(label('모드'), seg(MODES, sel.mode, (v) => ((sel.mode = v), draw())));

    const weaponGrid = (slot, key) => {
      const grid = document.createElement('div');
      grid.className = 'weapons';
      for (const [id, w] of Object.entries(weapons)) {
        if (w.slot !== slot) continue;
        const b = document.createElement('button');
        b.className = id === sel[key] ? 'on' : '';
        b.innerHTML = `${w.name}<small>${w.auto ? '자동' : '반자동'} · ${w.fireRate}발/초</small>`;
        b.onclick = () => ((sel[key] = id), draw());
        grid.append(b);
      }
      return grid;
    };
    card.append(label('주무기 (1번)'), weaponGrid('primary', 'primary'));
    card.append(label('보조무기 (2번) · 3번은 칼'), weaponGrid('secondary', 'secondary'));

    const judgeRow = document.createElement('div');
    judgeRow.className = 'row';
    judgeRow.style.gap = '28px';
    const j = document.createElement('div');
    j.append(label('판정 방식'), seg(JUDGES, sel.judge, (v) => ((sel.judge = v), draw())));
    const a = document.createElement('div');
    a.append(label('방어구'), seg(ARMORS, sel.armor, (v) => ((sel.armor = v), draw()), sel.judge !== 'kill'));
    const f = document.createElement('div');
    f.append(label('봇 반격'), seg(BOT_FIRE, sel.botFire, (v) => ((sel.botFire = v), draw())));
    const bj = document.createElement('div');
    bj.append(label('브레이킹 판정 (이동 사격 무효)'), seg(BRAKE_JUDGE, sel.brakeJudge, (v) => ((sel.brakeJudge = v), draw())));
    judgeRow.append(j, a, f, bj);
    card.append(judgeRow);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const start = document.createElement('button');
    start.className = 'btn primary';
    start.textContent = '시작';
    start.onclick = () => onStart({ ...sel });
    const set = document.createElement('button');
    set.className = 'btn';
    set.textContent = '설정';
    set.onclick = onSettings;
    const quit = document.createElement('button');
    quit.className = 'btn';
    quit.textContent = '종료';
    quit.onclick = onQuit;
    actions.append(start, set, quit);
    card.append(actions);

    if (rawInput === false) {
      const w = document.createElement('p');
      w.className = 'warn';
      w.textContent = '원본 마우스 입력(가속 무시)을 쓸 수 없어 일반 입력으로 동작 중입니다. 윈도우 "포인터 정확도 향상"을 꺼 주세요.';
      card.append(w);
    }

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = `<span class="kbd">WASD</span> 이동 · <span class="kbd">Shift</span> 걷기 · <span class="kbd">Ctrl</span> 앉기 · <span class="kbd">Space</span> 점프 ·
      <span class="kbd">R</span> 재장전 · <span class="kbd">B</span> 무기 교환 · <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> 무기 교체(칼: 왼쪽/오른쪽 클릭) · <span class="kbd">Esc</span> 일시정지<br/>
      피킹 대응: 빛나는 엄폐물 모서리를 미리 조준하세요. 미세 조정: 노란 점에 조준선을 0.3초 올리면 봇이 나타납니다.<br/>
      플릭 전환: 시야 곳곳에 봇이 하나씩 나타납니다. 1.5초 안에 머리를 맞히세요.<br/>
      각 확인: 맵 곳곳의 벽 뒤에 봇 여러 명이 숨어 있습니다. 직접 돌아다니며 각을 확인하고 처리하세요.<br/>
      브레이킹 연습: A/D로 좌우로 달리다가 봇 머리 위에 초록 신호가 뜨면 반대 키(톡)나 키 떼기(만세)로 멈추고 헤드를 맞히세요.`;
    card.append(hint);
  }

  draw();
  root.replaceChildren(screen);
}

export function renderSettings(root, { settings, onSave, onBack }) {
  const s = structuredClone(settings);
  const screen = document.createElement('div');
  screen.className = 'screen';
  const card = document.createElement('div');
  card.className = 'card';
  screen.append(card);
  card.innerHTML = `<h1 class="title">설정</h1>
    <p class="sub">그 밖의 값은 설정 파일(settings.json)에서 바꿀 수 있습니다.</p>
    <div class="form">
      <label>마우스 DPI</label><input type="number" id="dpi" min="100" max="32000" step="50" />
      <label>발로란트 감도</label><div class="row"><input type="number" id="sens" min="0.01" max="10" step="0.001" /><span class="note" id="cm"></span></div>
      <label>한 판 봇 수</label><input type="number" id="bots" min="1" max="200" step="1" />
      <label>엄폐물 표시(피킹 대응)</label><input type="checkbox" id="hl" />
      <label>와이드 피킹 비율</label><div class="row"><input type="range" id="wide" min="0" max="1" step="0.05" /><span class="note" id="wideV"></span></div>
      <label>조준점 코드</label>
      <div class="xh">
        <div class="row"><input type="text" id="xh" spellcheck="false" placeholder="발로란트 설정 → 조준선 → 프로필 코드 가져오기" />
          <button class="btn" id="xhReset" type="button">기본값</button></div>
        <div class="row"><canvas id="xhReal" width="120" height="120"></canvas><canvas id="xhZoom" width="120" height="120"></canvas>
          <span class="note" id="xhMsg"></span></div>
      </div>
      <label>소리</label><input type="checkbox" id="snd" />
      <label>음량</label><input type="range" id="vol" min="0" max="1" step="0.05" />
      <label>봇 발소리</label><input type="checkbox" id="steps" />
      <label>브레이킹 표시(쏠 때마다)</label><input type="checkbox" id="brk" />
      <label>속도 막대(데드존 27.5%)</label><input type="checkbox" id="spd" />
      <label>키보드·마우스 입력 표시</label><input type="checkbox" id="kbv" />
      <label>총알 궤적</label><input type="checkbox" id="trc" />
      <label>탄흔·명중 불꽃</label><input type="checkbox" id="imp" />
    </div>
    <div class="actions"><button class="btn primary" id="save">저장</button><button class="btn" id="back">돌아가기</button></div>`;
  const $ = (id) => card.querySelector(`#${id}`);
  $('dpi').value = s.mouse.dpi;
  $('sens').value = s.mouse.sens;
  $('bots').value = s.session.botCount;
  $('hl').checked = s.session.coverHighlight;
  $('wide').value = s.peek.wideRatio;
  $('xh').value = s.crosshairCode;
  $('snd').checked = s.audio.enabled;
  $('vol').value = s.audio.volume;
  $('steps').checked = s.audio.footsteps;
  $('brk').checked = s.brake.indicator;
  $('spd').checked = s.brake.speedBar;
  $('kbv').checked = s.display.inputOverlay;
  $('trc').checked = s.effects.tracers;
  $('imp').checked = s.effects.impacts;
  const refresh = () => {
    const dpi = Number($('dpi').value);
    const sens = Number($('sens').value);
    $('cm').textContent = dpi > 0 && sens > 0 ? cm360Label(dpi, sens) : '';
    $('wideV').textContent = `${Math.round(Number($('wide').value) * 100)}%`;
    drawXhair();
  };
  // 조준점 미리보기: 왼쪽은 게임과 같은 크기, 오른쪽은 3배 확대
  function drawXhair() {
    const code = $('xh').value.trim();
    const ok = isCrosshairCode(code);
    const ch = parseCrosshairCode(ok ? code : s.crosshairCode);
    for (const [id, zoom] of [['xhReal', 1], ['xhZoom', 3]]) {
      const c = $(id);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#77736c';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#cdbb9e';
      g.fillRect(0, 0, c.width, c.height / 2);
      drawCrosshair(g, ch, c.width / 2, c.height / 2, (window.innerHeight / 1080) * zoom);
    }
    $('xhMsg').textContent = !code ? '' : ok ? '적용 가능한 코드입니다. 저장하면 바로 바뀝니다.' : '조준선 코드가 아닙니다. 저장해도 이전 조준점을 유지합니다.';
    $('xhMsg').className = ok || !code ? 'note' : 'warn';
  }
  $('xhReset').onclick = () => {
    $('xh').value = DEFAULT_SETTINGS.crosshairCode;
    drawXhair();
  };
  card.addEventListener('input', refresh);
  refresh();

  const num = (id, def, min) => {
    const v = Number($(id).value);
    return Number.isFinite(v) && v >= min ? v : def;
  };
  $('save').onclick = () => {
    s.mouse.dpi = num('dpi', s.mouse.dpi, 100);
    s.mouse.sens = num('sens', s.mouse.sens, 0.01);
    s.session.botCount = Math.round(num('bots', s.session.botCount, 1));
    s.session.coverHighlight = $('hl').checked;
    s.peek.wideRatio = num('wide', s.peek.wideRatio, 0);
    const code = $('xh').value.trim();
    if (isCrosshairCode(code)) s.crosshairCode = code;
    s.audio.enabled = $('snd').checked;
    s.audio.volume = num('vol', s.audio.volume, 0);
    s.audio.footsteps = $('steps').checked;
    s.brake.indicator = $('brk').checked;
    s.brake.speedBar = $('spd').checked;
    s.display.inputOverlay = $('kbv').checked;
    s.effects.tracers = $('trc').checked;
    s.effects.impacts = $('imp').checked;
    onSave(s);
  };
  $('back').onclick = onBack;
  root.replaceChildren(screen);
}

// 무기 교환 창(B): 주무기/보조무기를 눌러 바로 바꾼다.
export function renderShop(root, { weapons, loadout, onBuy, onClose }) {
  const screen = document.createElement('div');
  screen.className = 'screen shop';
  const card = document.createElement('div');
  card.className = 'card';
  screen.append(card);
  const draw = () => {
    card.innerHTML = `<h1 class="title">무기 <span>교환</span></h1>
      <p class="sub">고르면 탄창이 가득 찬 새 총으로 바뀝니다. 시간이 멈춰 있습니다. <span class="kbd">B</span> 또는 <span class="kbd">Esc</span>로 닫기</p>`;
    for (const [slot, title] of [['primary', '주무기 (1번)'], ['secondary', '보조무기 (2번)']]) {
      const l = document.createElement('div');
      l.className = 'label';
      l.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'weapons';
      for (const [id, w] of Object.entries(weapons)) {
        if (w.slot !== slot) continue;
        const b = document.createElement('button');
        b.className = id === loadout[slot] ? 'on' : '';
        b.innerHTML = `${w.name}<small>${w.auto ? '자동' : '반자동'} · ${w.magazine}발</small>`;
        b.onclick = () => {
          loadout = { ...loadout, [slot]: id };
          onBuy(slot, id);
          draw();
        };
        grid.append(b);
      }
      card.append(l, grid);
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    const close = document.createElement('button');
    close.className = 'btn primary';
    close.textContent = '닫고 계속';
    close.onclick = onClose;
    actions.append(close);
    card.append(actions);
  };
  draw();
  root.replaceChildren(screen);
}

export function renderPause(root, { onResume, onEnd, onMenu }) {
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `<div class="card" style="width:420px">
    <h1 class="title">일시정지</h1><p class="sub">시간이 멈춰 있습니다.</p>
    <div class="actions" style="flex-direction:column">
      <button class="btn primary" id="resume">계속</button>
      <button class="btn" id="end">끝내고 결과 보기</button>
      <button class="btn" id="menu">메인으로</button>
    </div></div>`;
  screen.querySelector('#resume').onclick = onResume;
  screen.querySelector('#end').onclick = onEnd;
  screen.querySelector('#menu').onclick = onMenu;
  root.replaceChildren(screen);
}
