import { test, expect } from 'vitest';
import fs from 'node:fs';

// #ui > * (1,0,0)가 .hud의 pointer-events:none을 덮으면 HUD가 클릭을 가로채 재잠금이 불가능해진다.
test('hud layer never captures clicks', () => {
  const css = fs.readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
  expect(css).toMatch(/#ui\s*>\s*\.hud\s*\{[^}]*pointer-events:\s*none/);
});
