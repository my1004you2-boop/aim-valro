// 포인터 잠금과 키/마우스 상태. 잠금이 풀린 동안의 입력은 버린다.
export function createInput(canvas) {
  const lockListeners = [];
  const input = {
    keys: new Set(),
    mouseDown: false,
    pressedThisFrame: false,
    locked: false,
    rawSupported: null,
    dx: 0,
    dy: 0,
    onLockChange(cb) {
      lockListeners.push(cb);
    },
    async requestLock() {
      try {
        await canvas.requestPointerLock({ unadjustedMovement: true });
        input.rawSupported = true;
        return 'raw';
      } catch {
        try {
          await canvas.requestPointerLock();
        } catch {
          /* 사용자 제스처가 없으면 실패할 수 있다 */
        }
        input.rawSupported = false;
        return 'fallback';
      }
    },
    exitLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    consumeMouse() {
      const d = { dx: input.dx, dy: input.dy };
      input.dx = 0;
      input.dy = 0;
      return d;
    },
    endFrame() {
      input.pressedThisFrame = false;
    },
  };

  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked) {
      input.keys.clear();
      input.mouseDown = false;
      input.dx = 0;
      input.dy = 0;
    }
    lockListeners.forEach((cb) => cb(input.locked));
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.dx += e.movementX;
    input.dy += e.movementY;
  });
  document.addEventListener('mousedown', (e) => {
    if (!input.locked || e.button !== 0) return;
    input.mouseDown = true;
    input.pressedThisFrame = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  window.addEventListener('keydown', (e) => {
    if (!input.locked) return;
    if (e.code !== 'F11' && e.code !== 'F12') e.preventDefault();
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  return input;
}
