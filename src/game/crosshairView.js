// 1080p 기준 픽셀 크기로 조준선을 그린다. 중앙 픽셀(cx, cy)을 기준으로 대칭이다.
function rects(ch, cx, cy, s) {
  const out = [];
  const px = (v) => Math.max(1, Math.round(v * s));
  const arm = (l) => {
    if (!l.on || l.length <= 0 || l.opacity <= 0) return;
    const t = px(l.thickness);
    const len = px(l.length);
    const vlen = px(l.vLength);
    const gap = Math.round(l.offset * s);
    const half = Math.floor((t - 1) / 2);
    out.push({ x: cx + 1 + gap, y: cy - half, w: len, h: t, a: l.opacity });
    out.push({ x: cx - gap - len, y: cy - half, w: len, h: t, a: l.opacity });
    out.push({ x: cx - half, y: cy + 1 + gap, w: t, h: vlen, a: l.opacity });
    out.push({ x: cx - half, y: cy - gap - vlen, w: t, h: vlen, a: l.opacity });
  };
  if (ch.centerDot.on) {
    const t = px(ch.centerDot.thickness);
    const half = Math.floor((t - 1) / 2);
    out.push({ x: cx - half, y: cy - half, w: t, h: t, a: ch.centerDot.opacity });
  }
  arm(ch.inner);
  arm(ch.outer);
  return out;
}

export function drawCrosshair(ctx, ch, cx, cy, scale) {
  const list = rects(ch, Math.floor(cx), Math.floor(cy), scale);
  if (ch.outlines.on && ch.outlines.opacity > 0) {
    const o = Math.max(1, Math.round(ch.outlines.thickness * scale));
    ctx.fillStyle = `rgba(0,0,0,${ch.outlines.opacity})`;
    for (const r of list) ctx.fillRect(r.x - o, r.y - o, r.w + 2 * o, r.h + 2 * o);
  }
  ctx.fillStyle = ch.color;
  for (const r of list) {
    ctx.globalAlpha = r.a;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.globalAlpha = 1;
}

export function createCrosshairOverlay(canvas, crosshair) {
  const ctx = canvas.getContext('2d');
  let ch = crosshair;
  const redraw = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    drawCrosshair(ctx, ch, canvas.width / 2, canvas.height / 2, canvas.height / 1080);
  };
  window.addEventListener('resize', redraw);
  redraw();
  return {
    set(next) {
      ch = next;
      redraw();
    },
    setVisible(v) {
      canvas.style.visibility = v ? 'visible' : 'hidden';
    },
  };
}
