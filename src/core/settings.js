export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  mouse: { dpi: 1600, sens: 0.194 },
  hfov: 103,
  crosshairCode: '0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002',
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    walk: 'ShiftLeft', crouch: 'ControlLeft', jump: 'Space', reload: 'KeyR',
    slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3',
  },
  session: { botCount: 30, nextBotDelay: [0.5, 1.5], coverHighlight: true },
  buckets: {
    distance: [[5, 15], [15, 30], [30, 50]],
    heightEdge: 1.5,
    enabled: { distance: [true, true, true], height: [true, true, true] },
  },
  peek: { wideRatio: 0.5, exposedTime: [0.25, 0.9], hiddenTime: [0.3, 1.2] },
  micro: { offsetDeg: [1, 4], timeLimit: 1.5, holdTime: 0.3, botStrafe: true },
  flick: { angleDeg: [8, 75], distance: [6, 40], timeLimit: 1.5 },
  clear: { waveSize: 4, revealAfter: 25 },
  strafe: { angleDeg: [0, 12], distance: [10, 25], moveTime: [0.4, 1.2], timeLimit: 1.2 },
  brake: { indicator: true, speedBar: true },
  display: { inputOverlay: true },
  bot: { colors: { head: '#ff4655', body: '#3a4250', legs: '#2a303a' } },
  audio: { enabled: true, volume: 0.6, footsteps: true },
  effects: { tracers: true, impacts: true },
  last: { mode: 'peek', primary: 'vandal', secondary: 'classic', judge: 'head', armor: 0, botFire: 'off', brakeJudge: false },
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// 배열은 기본값과 길이가 같고 원소 타입(중첩 배열 포함)이 같을 때만 받는다.
function sameShape(def, v) {
  if (Array.isArray(def)) return Array.isArray(v) && v.length === def.length && def.every((d, i) => sameShape(d, v[i]));
  return typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v));
}

// 기본값의 구조와 타입을 기준으로 저장된 값을 덮어쓴다. 배열은 통째로 바꾼다.
function mergeInto(def, saved) {
  if (isPlainObject(def)) {
    const out = {};
    const src = isPlainObject(saved) ? saved : {};
    for (const k of Object.keys(def)) out[k] = mergeInto(def[k], src[k]);
    return out;
  }
  if (Array.isArray(def)) return structuredClone(sameShape(def, saved) ? saved : def);
  return sameShape(def, saved) ? saved : def;
}

// 값이 범위를 벗어나면 기본값으로 되돌린다(세션이 멈추거나 시점이 안 돌아가는 값 방지).
const LIMITS = [
  [['mouse', 'sens'], (v) => v > 0 && v <= 20],
  [['mouse', 'dpi'], (v) => v >= 100 && v <= 64000],
  [['hfov'], (v) => v >= 70 && v <= 130],
  [['session', 'botCount'], (v) => Number.isInteger(v) && v >= 1 && v <= 500],
];

export function mergeSettings(saved) {
  const s = mergeInto(DEFAULT_SETTINGS, saved);
  for (const [path, ok] of LIMITS) {
    const parent = path.slice(0, -1).reduce((o, k) => o[k], s);
    const key = path[path.length - 1];
    if (!ok(parent[key])) parent[key] = path.reduce((o, k) => o[k], DEFAULT_SETTINGS);
  }
  return s;
}

export function parseSettingsText(text) {
  if (text == null) return mergeSettings({});
  try {
    return mergeSettings(JSON.parse(text));
  } catch {
    return mergeSettings({});
  }
}
