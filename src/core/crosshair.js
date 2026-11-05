// 발로란트 조준선 코드(주 조준선 섹션 P)를 해석한다.
const COLORS = ['#FFFFFF', '#00FF00', '#7FFF00', '#DFFF00', '#FFFF00', '#00FFFF', '#FF00FF', '#FF0000'];
const SECTIONS = new Set(['P', 'A', 'S']);

function readPrimary(code) {
  const parts = String(code ?? '').split(';');
  const kv = {};
  let section = null;
  // 첫 토큰은 코드 버전 번호다.
  for (let i = 1; i < parts.length; i++) {
    const tok = parts[i];
    if (SECTIONS.has(tok)) {
      section = tok;
      continue;
    }
    if (i + 1 >= parts.length) break;
    if (section === 'P') kv[tok] = parts[i + 1];
    i++;
  }
  return kv;
}

// 주 조준선(P) 섹션에 값이 하나라도 있으면 조준선 코드로 본다.
export function isCrosshairCode(code) {
  return Object.keys(readPrimary(code)).length > 0;
}

export function parseCrosshairCode(code) {
  const kv = readPrimary(code);
  const num = (k, def) => {
    const v = Number(kv[k]);
    return k in kv && Number.isFinite(v) ? v : def;
  };
  const flag = (k, def) => num(k, def ? 1 : 0) === 1;

  let color = COLORS[num('c', 0)] ?? COLORS[0];
  if (num('c', 0) === 8 && /^[0-9a-fA-F]{6}/.test(kv.u ?? '')) color = `#${kv.u.slice(0, 6).toUpperCase()}`;

  const lines = (p, d) => {
    const length = num(`${p}l`, d.length);
    return {
      on: flag(`${p}b`, true),
      thickness: num(`${p}t`, d.thickness),
      length,
      vLength: flag(`${p}g`, false) ? num(`${p}v`, length) : length,
      offset: num(`${p}o`, d.offset),
      opacity: num(`${p}a`, d.opacity),
    };
  };

  return {
    color,
    outlines: { on: flag('h', true), thickness: num('t', 1), opacity: num('o', 0.5) },
    centerDot: { on: flag('d', false), thickness: num('z', 2), opacity: num('a', 1) },
    inner: lines('0', { thickness: 2, length: 6, offset: 3, opacity: 0.8 }),
    outer: lines('1', { thickness: 2, length: 2, offset: 10, opacity: 0.35 }),
  };
}
