export const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  mouse: { dpi: 1600, sens: 0.194 },
  hfov: 103,
  crosshairCode: '0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002',
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    walk: 'ShiftLeft', crouch: 'ControlLeft', jump: 'Space', reload: 'KeyR',
  },
  session: { botCount: 30, nextBotDelay: [0.5, 1.5], coverHighlight: true },
  buckets: {
    distance: [[5, 15], [15, 30], [30, 50]],
    heightEdge: 1.5,
    enabled: { distance: [true, true, true], height: [true, true, true] },
  },
  peek: { wideRatio: 0.5, exposedTime: [0.25, 0.9], hiddenTime: [0.3, 1.2] },
  micro: { offsetDeg: [1, 4], timeLimit: 1.5, holdTime: 0.3, botStrafe: true },
  bot: { colors: { head: '#ff4655', body: '#3a4250', legs: '#2a303a' } },
  audio: { enabled: true, volume: 0.6 },
  last: { mode: 'peek', weapon: 'vandal', judge: 'head', armor: 0 },
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// 기본값의 구조와 타입을 기준으로 저장된 값을 덮어쓴다. 배열은 통째로 바꾼다.
function mergeInto(def, saved) {
  if (isPlainObject(def)) {
    const out = {};
    const src = isPlainObject(saved) ? saved : {};
    for (const k of Object.keys(def)) out[k] = mergeInto(def[k], src[k]);
    return out;
  }
  if (Array.isArray(def)) return Array.isArray(saved) ? structuredClone(saved) : structuredClone(def);
  return typeof saved === typeof def ? saved : def;
}

export function mergeSettings(saved) {
  return mergeInto(DEFAULT_SETTINGS, saved);
}

export function parseSettingsText(text) {
  if (text == null) return mergeSettings({});
  try {
    return mergeSettings(JSON.parse(text));
  } catch {
    return mergeSettings({});
  }
}
