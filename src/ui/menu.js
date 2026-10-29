import { cm360Label } from './format.js';

const MODES = [
  ['peek', '피킹 대응'],
  ['micro', '미세 조정'],
];
const JUDGES = [
  ['head', '헤드 전용'],
  ['kill', '처치'],
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
  if (!weapons[sel.weapon]) sel.weapon = 'vandal';

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

    card.append(label('총기'));
    const grid = document.createElement('div');
    grid.className = 'weapons';
    for (const [id, w] of Object.entries(weapons)) {
      const b = document.createElement('button');
      b.className = id === sel.weapon ? 'on' : '';
      b.innerHTML = `${w.name}<small>${w.auto ? '자동' : '반자동'} · ${w.fireRate}발/초</small>`;
      b.onclick = () => ((sel.weapon = id), draw());
      grid.append(b);
    }
    card.append(grid);

    const judgeRow = document.createElement('div');
    judgeRow.className = 'row';
    judgeRow.style.gap = '28px';
    const j = document.createElement('div');
    j.append(label('판정 방식'), seg(JUDGES, sel.judge, (v) => ((sel.judge = v), draw())));
    const a = document.createElement('div');
    a.append(label('방어구'), seg(ARMORS, sel.armor, (v) => ((sel.armor = v), draw()), sel.judge !== 'kill'));
    judgeRow.append(j, a);
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
      <span class="kbd">R</span> 재장전 · <span class="kbd">Esc</span> 일시정지<br/>
      피킹 대응: 빛나는 엄폐물 모서리를 미리 조준하세요. 미세 조정: 노란 점에 조준선을 0.3초 올리면 봇이 나타납니다.`;
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
      <label>소리</label><input type="checkbox" id="snd" />
      <label>음량</label><input type="range" id="vol" min="0" max="1" step="0.05" />
    </div>
    <div class="actions"><button class="btn primary" id="save">저장</button><button class="btn" id="back">돌아가기</button></div>`;
  const $ = (id) => card.querySelector(`#${id}`);
  $('dpi').value = s.mouse.dpi;
  $('sens').value = s.mouse.sens;
  $('bots').value = s.session.botCount;
  $('hl').checked = s.session.coverHighlight;
  $('wide').value = s.peek.wideRatio;
  $('snd').checked = s.audio.enabled;
  $('vol').value = s.audio.volume;
  const refresh = () => {
    const dpi = Number($('dpi').value);
    const sens = Number($('sens').value);
    $('cm').textContent = dpi > 0 && sens > 0 ? cm360Label(dpi, sens) : '';
    $('wideV').textContent = `${Math.round(Number($('wide').value) * 100)}%`;
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
    s.audio.enabled = $('snd').checked;
    s.audio.volume = num('vol', s.audio.volume, 0);
    onSave(s);
  };
  $('back').onclick = onBack;
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
