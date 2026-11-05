// 입력 표시: 왼쪽 아래 키보드, 오른쪽 아래 마우스. 누르고 있는 버튼이 밝아진다.
const NAMED = {
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  AltLeft: 'Alt', AltRight: 'Alt', Space: 'Space', Tab: 'Tab', CapsLock: 'Caps',
};

export function keyLabel(code) {
  if (NAMED[code]) return NAMED[code];
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  return m ? m[1] : code;
}

const SHOP_KEY = 'KeyB';

// 줄마다 [키 설정 이름 또는 코드, 열 위치, 넓이]
function layout(k) {
  return [
    [[k.slot1, 0], [k.slot2, 1], [k.slot3, 2], [k.reload, 3]],
    [[k.forward, 1], [SHOP_KEY, 3]],
    [[k.left, 0], [k.back, 1], [k.right, 2]],
    [[k.walk, 0, 1.5], [k.crouch, 1.5, 1.5], [k.jump, 3, 2]],
  ];
}

export function overlayKeys(keys, held) {
  return layout(keys).map((row) => row.map(([code, col, wide = 1]) => ({ code, label: keyLabel(code), on: held.has(code), col, wide })));
}

const UNIT = 34;
const GAP = 4;

export function createInputOverlay(root, keys) {
  const kb = document.createElement('div');
  kb.className = 'kbview';
  const rows = overlayKeys(keys, new Set());
  const cells = [];
  rows.forEach((row, r) => {
    for (const k of row) {
      const el = document.createElement('div');
      el.className = 'k';
      el.textContent = k.label;
      el.style.left = `${k.col * (UNIT + GAP)}px`;
      el.style.top = `${r * (UNIT + GAP)}px`;
      el.style.width = `${k.wide * UNIT + (k.wide - 1) * GAP}px`;
      kb.append(el);
      cells.push({ code: k.code, el });
    }
  });
  kb.style.width = `${5 * UNIT + 4 * GAP}px`;
  kb.style.height = `${rows.length * (UNIT + GAP) - GAP}px`;

  const mouse = document.createElement('div');
  mouse.className = 'mouseview';
  mouse.innerHTML = '<div class="mb l"></div><div class="mb r"></div><div class="wheel"></div><div class="body"></div>';
  const left = mouse.querySelector('.l');
  const right = mouse.querySelector('.r');

  root.append(kb, mouse);
  let last = '';
  return {
    update(held, { left: l, right: r }) {
      const key = `${[...held].sort().join(',')}|${l}|${r}`;
      if (key === last) return;
      last = key;
      for (const c of cells) c.el.classList.toggle('on', held.has(c.code));
      left.classList.toggle('on', l);
      right.classList.toggle('on', r);
    },
    setVisible(v) {
      kb.style.display = v ? 'block' : 'none';
      mouse.style.display = v ? 'block' : 'none';
    },
  };
}
