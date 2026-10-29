# 에임 트레이너 1·2단계(기반 + 사격장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발로란트와 같은 감도·시야·조준선·이동·총기 특성을 가진 설치형 사격장을 만든다. 모드 1(피킹 대응)과 모드 2(미세 조정), 결과 화면까지 포함한다.

**Architecture:** Electron 메인 프로세스는 창, 프레임 제한 해제, 설정/결과 파일 입출력(IPC)만 맡는다. 렌더러는 Vite로 묶은 ES 모듈이다. 계산 로직(`src/core/`)은 Three.js나 DOM에 의존하지 않는 순수 함수로 만들어 Vitest로 테스트하고, `src/game/`이 이것을 Three.js 장면에 연결한다. 월드 충돌은 축 정렬 박스(AABB) 목록으로 처리하고, 고정 시간 간격(1/240초)으로 계산한다.

**Tech Stack:** Electron, Three.js, Vite, Vitest, electron-builder. Node 24, npm 11.

**Spec:** `docs/superpowers/specs/2026-10-29-aim-trainer-design.md` (이 계획은 1·2단계만 다룬다. 3단계(실전 맵, 모드 3)는 별도 계획으로 세운다.)

## Global Constraints

- 대상: Windows 11, 1920×1080 16:9 165Hz. 165fps 이상을 안정적으로 유지해야 한다.
- Electron 스위치 `disable-frame-rate-limit`, `disable-gpu-vsync`를 켜고, 기본은 전체화면으로 실행한다.
- 감도: 회전(도) = 카운트 × 0.07 × 감도. 기본값은 DPI 1600, 감도 0.194다. 마우스 입력은 Pointer Lock `unadjustedMovement: true`로 받는다.
- 시야: 가로 103도. 16:9보다 좁은 화면에서는 16:9 기준 세로 FOV를 유지한다.
- 조준선 기본 코드: `0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002`
- 이동·총기·방어구 수치는 `data/*.json`에만 둔다. 각 파일에 `source`, `patch` 필드를 넣고, 근사값인 항목은 `approx: true`로 표시한다.
- 발로란트 자산, 맵 레이아웃, 특정 요원 외형, 로고를 쓰지 않는다. 봇은 독자 디자인의 인간형이다.
- 키: W/A/S/D 이동, Shift 걷기, Ctrl 앉기(누르는 동안), Space 점프, 왼쪽 클릭 사격, R 재장전, Esc 일시정지.
- 설정은 `userData/settings.json`, 결과는 `userData/sessions/<ISO날짜>-<mode>.json`에 저장한다.
- 거리 구간 기본값 5–15 / 15–30 / 30–50m. 높이 구간 경계는 ±1.5m(봇 발 높이 − 플레이어 발 높이).
- UI 문구는 한국어로 쓴다.

## Review Focus

1. **창 전환(Alt+Tab)이나 포인터 잠금 해제**: 즉시 일시정지 메뉴를 띄우고, 잠금이 풀린 동안 들어온 입력은 회전이나 사격에 쓰지 않는다. → Task 2 테스트 `ignores mouse input when pointer is not locked`, Task 14 수동 확인.
2. **프레임 지연(한 프레임 dt가 0.25초 이상)**: 플레이어가 벽을 통과하거나 하늘로 튀지 않는다. → Task 5 테스트 `large dt does not tunnel through wall`.
3. **settings.json이 없거나 깨졌거나 예전 형식인 경우**: 기본값으로 실행하고, 빠진 키는 기본값으로 채운다. → Task 3 테스트 `mergeSettings fills missing keys` / `corrupt json falls back to defaults`.
4. **봇이 벽 모서리 뒤에 일부만 숨어 있을 때 쏜 경우**: 벽이 먼저 맞으면 봇 판정이 없다. → Task 9 테스트 `wall in front blocks hitbox`.
5. **재장전 중이거나 탄창이 빈 상태에서 클릭을 누르고 있는 경우**: 발사되지 않고, 재장전이 끝나면 자동 총기는 누르고 있는 동안 다시 연사된다. → Task 7 테스트 `holding trigger through reload resumes auto fire`.

---

## 파일 구조

```
package.json, vite.config.js, electron-builder.yml
electron/main.js            창 생성, 스위치, IPC(settings:load/save, session:save)
electron/preload.cjs        window.api = { loadSettings, saveSettings, saveSession }
index.html                  캔버스 + HUD/메뉴 DOM
data/movement.json          이동·점프·이동 정확도 수치
data/weapons.json           총기 12종
data/armor.json             방어구 규칙
data/range.json             사격장 박스 목록 + 엄폐물 지점
src/core/sensitivity.js     감도·cm/360
src/core/fov.js             FOV 환산
src/core/crosshair.js       조준선 코드 해석
src/core/settings.js        기본값·병합
src/core/physics.js         플레이어 이동 + AABB 충돌
src/core/weapon.js          총기 상태(연사·탄창·재장전·퍼짐·반동)
src/core/damage.js          거리별 데미지·방어구
src/core/spread.js          퍼짐 방향 샘플링
src/core/peek.js            봇 피킹 상태 기계
src/core/spawn.js           엄폐물 지점 선택(구간 균형)
src/core/buckets.js         거리·높이 구간 분류
src/core/stats.js           기록 집계·3×3 표
src/game/app.js             루프, 화면 전환
src/game/input.js           포인터 잠금, 키 상태
src/game/look.js            카메라 회전
src/game/world.js           range.json → Three.js 메시 + 충돌 박스
src/game/crosshairView.js   2D 오버레이 그리기
src/game/botModel.js        인간형 모델 + 히트박스 + 절차적 애니메이션
src/game/shooting.js        레이캐스트 판정
src/game/session.js         모드 1/2 진행·기록
src/game/audio.js           합성 효과음
src/ui/menu.js, hud.js, results.js, style.css
tests/*.test.js             core 모듈 테스트
```

---

### Task 1: 프로젝트 뼈대 + 빈 장면 + FPS 표시

**Files:**
- Create: `package.json`, `vite.config.js`, `electron/main.js`, `electron/preload.cjs`, `index.html`, `src/game/app.js`, `src/ui/style.css`, `tests/smoke.test.js`, `.gitignore`

**Interfaces:**
- Produces: `npm run dev`(Vite 서버 + Electron), `npm test`(Vitest), `npm run build`(Vite 빌드), `src/game/app.js`의 `startApp(canvas: HTMLCanvasElement): void`

- [ ] **Step 1:** `git init`, `npm init`, 그리고 `three`, `electron`, `vite`, `vitest`, `electron-builder`, `concurrently`, `wait-on`을 설치한다. `.gitignore`에 `node_modules`, `dist`, `release`를 넣는다.
- [ ] **Step 2:** `tests/smoke.test.js`에 `expect(1+1).toBe(2)`를 쓰고 `npm test`를 실행한다. Expected: 1 passed.
- [ ] **Step 3:** `electron/main.js`를 만든다. `app.commandLine.appendSwitch('disable-frame-rate-limit')`, `appendSwitch('disable-gpu-vsync')`를 넣고, `fullscreen: true`, `backgroundColor: '#0f1115'`, `contextIsolation: true`로 창을 만든다. 개발 때는 `VITE_DEV_SERVER_URL`을 열고, 아니면 `dist/index.html`을 연다. Vite `base: './'`.
- [ ] **Step 4:** `startApp`은 `WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`로 바닥 하나와 조명이 있는 장면을 `requestAnimationFrame`으로 그리고, 오른쪽 위에 FPS(0.5초 평균)를 표시한다.
- [ ] **Step 5:** `npm run dev`를 실행한다. Expected: 전체화면 창이 열리고 FPS가 165를 넘는다(vsync 해제 확인).
- [ ] **Step 6:** Commit `chore: scaffold electron + three + vite`

### Task 2: 감도·FOV·카메라 회전

**Files:**
- Create: `src/core/sensitivity.js`, `src/core/fov.js`, `src/game/input.js`, `src/game/look.js`
- Test: `tests/sensitivity.test.js`, `tests/fov.test.js`, `tests/look.test.js`

**Interfaces:**
- Produces:
  - `degreesPerCount(sens: number): number`
  - `cmPer360(dpi: number, sens: number): number`
  - `verticalFovDeg(hfovDeg: number, aspect: number): number`
  - `createLook({ sens }): { yaw, pitch, applyMouse(dx, dy, locked: boolean), forward(): {x,y,z} }`. yaw와 pitch는 라디안이고 pitch는 ±89도로 제한한다. 마우스 오른쪽 이동(dx>0)이면 yaw가 줄어든다(Three.js 오른손 좌표계, 카메라 −Z가 정면).
  - `createInput(canvas): { keys: Set<string>, mouseDown: boolean, locked: boolean, onLockChange(cb), requestLock(): Promise<'raw'|'fallback'> }`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
expect(degreesPerCount(0.194)).toBeCloseTo(0.01358, 5);
expect(cmPer360(1600, 0.194)).toBeCloseTo(42.08, 1);
expect(verticalFovDeg(103, 16/9)).toBeCloseTo(70.53, 1);
expect(verticalFovDeg(103, 21/9)).toBeCloseTo(56.6, 1);  // 16:9 이상: 가로 103 기준
expect(verticalFovDeg(103, 4/3)).toBeCloseTo(70.53, 1);  // 좁은 화면: 16:9 세로 유지
// look
const l = createLook({ sens: 0.194 });
l.applyMouse(1000, 0, true);
expect(l.yaw * 180/Math.PI).toBeCloseTo(-13.58, 2);
l.applyMouse(0, -100000, true);
expect(l.pitch * 180/Math.PI).toBeCloseTo(89, 3);
// ignores mouse input when pointer is not locked
const before = l.yaw; l.applyMouse(500, 0, false); expect(l.yaw).toBe(before);
```

- [ ] **Step 2:** `npx vitest run tests/sensitivity.test.js tests/fov.test.js tests/look.test.js`를 실행한다. Expected: FAIL(모듈 없음).
- [ ] **Step 3:** 구현한다. 스펙대로 `aspect >= 16/9`이면 `2·atan(tan(h/2)/aspect)`, 그보다 좁으면 `2·atan(tan(h/2)/(16/9))`를 돌려준다. `requestLock`은 `canvas.requestPointerLock({ unadjustedMovement: true })`를 먼저 시도하고, 실패하면 일반 잠금을 걸고 `'fallback'`을 돌려준다(메뉴에 경고 표시).
- [ ] **Step 4:** 테스트를 실행한다. Expected: PASS.
- [ ] **Step 5:** `app.js`에 연결한다. 클릭하면 잠금이 걸리고, `mousemove`의 `movementX/Y`가 `applyMouse`로 들어간다. 창 크기가 바뀌면 `camera.fov`를 다시 계산한다. **수동 확인:** 인게임에서 한 바퀴 돌리는 마우스 거리와 비교해 42cm 근처인지 본다.
- [ ] **Step 6:** Commit `feat: valorant sensitivity, fov and raw mouse look`

### Task 3: 설정 저장소

**Files:**
- Create: `src/core/settings.js`, Modify: `electron/main.js`, `electron/preload.cjs`
- Test: `tests/settings.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_SETTINGS`(아래 구조), `mergeSettings(saved: unknown): Settings`, `parseSettingsText(text: string|null): Settings`
  - `window.api.loadSettings(): Promise<string|null>`, `saveSettings(text)`, `saveSession(name, text)`

```js
DEFAULT_SETTINGS = {
  version: 1,
  mouse: { dpi: 1600, sens: 0.194 }, hfov: 103,
  crosshairCode: '0;s;1;P;c;5;o;0.101;f;0;0t;1;0l;2;0v;2;0o;1;0a;1;0f;0;1b;0;S;s;1.002',
  keys: { forward:'KeyW', back:'KeyS', left:'KeyA', right:'KeyD', walk:'ShiftLeft', crouch:'ControlLeft', jump:'Space', reload:'KeyR' },
  session: { botCount: 30, nextBotDelay: [0.5, 1.5], coverHighlight: true },
  buckets: { distance: [[5,15],[15,30],[30,50]], heightEdge: 1.5, enabled: { distance:[true,true,true], height:[true,true,true] } },
  peek: { wideRatio: 0.5, exposedTime: [0.25, 0.9], hiddenTime: [0.3, 1.2] },
  micro: { offsetDeg: [1, 4], timeLimit: 1.5, holdTime: 0.3, botStrafe: true },
  bot: { colors: { head:'#ff4655', body:'#3a4250', legs:'#2a303a' } },
  audio: { enabled: true, volume: 0.6 },
  last: { mode: 'peek', weapon: 'vandal', judge: 'head', armor: 0 }
}
```

- [ ] **Step 1: 실패하는 테스트 작성** — `mergeSettings fills missing keys`: `mergeSettings({ mouse:{ sens:0.3 } })`의 결과는 `mouse.sens === 0.3`, `mouse.dpi === 1600`, `hfov === 103`이다. `corrupt json falls back to defaults`: `parseSettingsText('{oops')`의 결과는 `DEFAULT_SETTINGS`와 같다(`toEqual`). `parseSettingsText(null)`도 기본값이다. 배열은 통째로 바꾸고(병합하지 않음), 타입이 다른 값은 기본값을 쓴다(`mergeSettings({hfov:'x'}).hfov === 103`).
- [ ] **Step 2:** 실행한다. Expected: FAIL.
- [ ] **Step 3:** 깊은 병합으로 구현한다. main에서 `ipcMain.handle`로 `app.getPath('userData')` 아래 파일을 읽고 쓴다. 쓰기는 임시 파일에 쓴 다음 이름을 바꾼다.
- [ ] **Step 4:** 실행한다. Expected: PASS.
- [ ] **Step 5:** Commit `feat: settings store with defaults and safe merge`

### Task 4: 조준선 코드 해석 + 그리기

**Files:**
- Create: `src/core/crosshair.js`, `src/game/crosshairView.js`
- Test: `tests/crosshair.test.js`

**Interfaces:**
- Produces:
  - `parseCrosshairCode(code: string): Crosshair`, 구조: `{ color: '#RRGGBB', outlines: { on, thickness, opacity }, centerDot: { on, thickness, opacity }, inner: { on, thickness, length, vLength, offset, opacity }, outer: { on, thickness, length, vLength, offset, opacity } }`
  - `drawCrosshair(ctx: CanvasRenderingContext2D, ch: Crosshair, cx: number, cy: number, scale: number): void`. `scale = screenHeight / 1080`.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
const c = parseCrosshairCode(DEFAULT_SETTINGS.crosshairCode);
expect(c.color).toBe('#00FFFF');
expect(c.centerDot.on).toBe(false);
expect(c.outlines).toEqual({ on: true, thickness: 1, opacity: 0.101 });
expect(c.inner).toEqual({ on: true, thickness: 1, length: 2, vLength: 2, offset: 1, opacity: 1 });
expect(c.outer.on).toBe(false);
// 빈 코드 → 발로란트 기본값
const d = parseCrosshairCode('0');
expect(d.color).toBe('#FFFFFF');
expect(d.inner).toEqual({ on: true, thickness: 2, length: 6, vLength: 6, offset: 3, opacity: 0.8 });
expect(d.outer).toEqual({ on: true, thickness: 2, length: 2, vLength: 2, offset: 10, opacity: 0.35 });
// 사용자 지정 색 c;8 + u;RRGGBBAA
expect(parseCrosshairCode('0;P;c;8;u;12AB34FF').color).toBe('#12AB34');
// 0g;1 일 때만 세로 길이가 따로 적용됨
expect(parseCrosshairCode('0;P;0l;4;0v;9').inner.vLength).toBe(4);
expect(parseCrosshairCode('0;P;0g;1;0l;4;0v;9').inner.vLength).toBe(9);
```

- [ ] **Step 2:** 실행한다. Expected: FAIL.
- [ ] **Step 3:** 구현한다. `;`로 나눠서 키-값 쌍으로 읽는다. 섹션 표시는 `P`(주 조준선), `A`(조준), `S`(저격)다. `P` 안의 값만 쓰고 나머지는 무시한다. 색 번호 표는 0 `#FFFFFF`, 1 `#00FF00`, 2 `#7FFF00`, 3 `#DFFF00`, 4 `#FFFF00`, 5 `#00FFFF`, 6 `#FF00FF`, 7 `#FF0000`이다. 키는 `h` 테두리, `t` 테두리 두께, `o` 테두리 불투명도, `d` 중앙 점, `z` 점 두께, `a` 점 불투명도, `0b/1b` 표시, `0t/0l/0v/0g/0o/0a`(바깥은 `1…`)다. 그리기는 정수 픽셀 좌표에 맞춰서(흐림 방지) 테두리를 먼저 칠하고 선을 칠한다.
- [ ] **Step 4:** 실행한다. Expected: PASS.
- [ ] **Step 5:** 화면 중앙 오버레이 캔버스(`devicePixelRatio` 반영)에 그린다. **수동 확인:** 인게임 조준선 스크린샷과 나란히 놓고 크기를 비교한다.
- [ ] **Step 6:** Commit `feat: valorant crosshair code parser and overlay`

### Task 5: 발로란트 수치 조사 + 플레이어 이동 물리

**Files:**
- Create: `data/movement.json`, `src/core/physics.js`
- Test: `tests/physics.test.js`

**Interfaces:**
- Consumes: `data/movement.json`
- Produces:
  - `movement.json` 구조: `{ source, patch, runSpeed, walkMul, crouchMul, accel, friction, stopSpeed, jumpVelocity, gravity, airControl, eyeStand, eyeCrouch, height, crouchHeight, radius, stepHeight, crouchTransition }` (단위: m, s)
  - `createPlayer(spawn: {x,y,z}): PlayerState`. `PlayerState = { pos, vel, onGround, crouchT /*0~1*/ }`
  - `stepPlayer(p: PlayerState, input: { wishX, wishZ /*카메라 기준 −1~1*/, yaw, walk, crouch, jump }, boxes: AABB[], dt: number, M, weaponSpeedMul: number): void`. 내부에서 1/240초 단위로 나눠 계산한다.
  - `AABB = { min:{x,y,z}, max:{x,y,z} }`
  - `speedFraction(p, M): number` — 수평 속도 ÷ 달리기 속도

- [ ] **Step 1:** 웹에서 최신 발로란트 이동 수치를 조사한다(달리기 속도, 걷기·앉기 배율, 점프, 중력, 무기별 이동 속도). Valorant Fandom wiki, 공식 패치 노트, 커뮤니티 측정 자료를 교차 확인한다. 공개되지 않은 가감속 값은 "카운터 스트레이핑으로 약 0.1초 안에 정확도 기준 속도까지 떨어진다"는 감각에 맞추고 `approx: true`로 표시한다. 출처 URL을 `source`에 적는다.
- [ ] **Step 2: 실패하는 테스트 작성** (M = movement.json, 바닥 박스 하나와 벽 하나)
  - `reaches run speed`: W를 1초 누르면 수평 속도가 `M.runSpeed`의 ±2% 안이다.
  - `walk is slower`: walk=true이면 `M.runSpeed*M.walkMul`의 ±2% 안이다.
  - `counter strafe stops fast`: D로 최고 속도를 낸 뒤 A를 누르면, 0.15초 안에 `speedFraction`이 0.3 아래로 떨어진다.
  - `jump apex`: 점프 최고 높이가 `jumpVelocity²/(2·gravity)`의 ±3% 안이다.
  - `crouch lowers eye`: crouch를 `M.crouchTransition`초 이상 누르면 눈높이가 `M.eyeCrouch`다.
  - `large dt does not tunnel through wall`: 벽 0.2m 앞에서 W를 누른 채 `dt=0.5` 한 번을 계산하면, 플레이어가 벽 앞쪽에 남아 있다.
  - `steps up small ledge`: 0.3m 턱은 걸어서 올라가고, 0.6m 턱은 막힌다(stepHeight 기본 0.45, 조사 결과에 따라 조정).
- [ ] **Step 3:** 실행한다. Expected: FAIL.
- [ ] **Step 4:** 구현한다. 이동은 Quake 계열(가속 + 지면 마찰 + stopSpeed)로 한다. 충돌은 플레이어를 AABB로 보고 축별로 따로 처리한다(X → Z → Y). 1/240초 단위 계산이 터널링을 막는다.
- [ ] **Step 5:** 실행한다. Expected: PASS.
- [ ] **Step 6:** Commit `feat: valorant-like player movement with aabb collision`

### Task 6: 사격장 맵 + 월드 구성

**Files:**
- Create: `data/range.json`, `src/game/world.js`

**Interfaces:**
- Produces:
  - `range.json`: `{ spawn:{x,y,z,yaw}, boxes:[{min,max,color?}], covers:[CoverPoint] }`
  - `CoverPoint = { id, hide:{x,y,z}, dirs:[{x,z}] /*피킹 방향 단위벡터, 1~2개*/, shortDist /*m*/, wideDist /*m*/, edge:{x,y,z} /*표시용 모서리*/ }`
  - `buildWorld(scene, rangeData): { boxes: AABB[], meshes: THREE.Mesh[] }`

- [ ] **Step 1:** `range.json`을 만든다. 시작 위치에서 앞쪽 약 120도 안에 엄폐물 지점을 **18개 이상** 둔다. 거리 3구간 × 높이 3구간마다 최소 2개다. 높이는 아래층(발 높이 −3m), 같은 층, 2층 발판(+3m)이고, 위·아래 지점은 실제 발판 위에 있으며 계단으로 이어진다. 숏 피킹 거리는 0.5–0.8m(머리와 어깨만 보임), 와이드 피킹 거리는 1.8–2.5m다.
- [ ] **Step 2:** `buildWorld`를 구현한다. 박스는 `MeshStandardMaterial` 단색에 모서리 선을 넣는다. 메시를 합쳐서 그리기 호출을 줄인다(165fps 유지).
- [ ] **Step 3:** `tests/range.test.js`를 만든다. 모든 cover의 `hide` 아래 0.1m 안에 박스 윗면이 있는지(떠 있지 않음), 그리고 3×3 구간별 개수가 2개 이상인지(spawn 기준, Task 11의 `classifyBucket` 사용 — Task 11 전에는 이 테스트를 skip하고, Task 11에서 활성화) 확인한다.
- [ ] **Step 4:** `npm run dev`로 플레이어가 맵을 걸어 다니고, 계단과 2층에 올라갈 수 있는지 수동으로 확인한다.
- [ ] **Step 5:** Commit `feat: shooting range map`

### Task 7: 총기 수치 조사 + 총기 상태 + 데미지·방어구

**Files:**
- Create: `data/weapons.json`, `data/armor.json`, `src/core/weapon.js`, `src/core/damage.js`, `src/core/spread.js`
- Test: `tests/weapon.test.js`, `tests/damage.test.js`, `tests/spread.test.js`

**Interfaces:**
- Produces:
  - `weapons.json`: `{ source, patch, weapons: { [id]: Weapon } }`. id는 `classic, ghost, sheriff, frenzy, stinger, spectre, bulldog, guardian, phantom, vandal, ares, odin`이다.
  - `Weapon = { name, auto: boolean, fireRate /*발/초*/, magazine, reloadTime, moveSpeedMul, damage: [{ maxRange, head, body, legs }], spread: { stand, crouch, walk, run, air /*도, 원뿔 반각*/ }, firingError: { perShot, max, recovery /*초*/ }, recoil: { pitchPerShot, yawJitter, recoverRate, approx } }`
  - `armor.json`: `{ source, patch, hp: 100, types: { 0:{amount:0}, 25:{amount:25}, 50:{amount:50} }, absorb /*방어구가 흡수하는 비율*/ }`
  - `damageAt(w: Weapon, part: 'head'|'body'|'legs', distM: number): number`
  - `applyDamage(target: { hp, armor }, dmg: number, armorRules): { hp, armor, killed: boolean }`
  - `createWeaponState(w: Weapon): WeaponState`
  - `tryFire(s: WeaponState, now: number, triggerHeld: boolean, triggerPressedThisFrame: boolean): boolean` — 연사 간격, 자동/반자동, 탄창, 재장전 중 여부를 판단한다.
  - `updateWeapon(s, now, dt)`, `startReload(s, now)`, `currentSpreadDeg(s, w, stance: 'stand'|'crouch'|'walk'|'run'|'air', now): number`
  - `sampleSpread(dir: {x,y,z}, halfAngleDeg: number, rng: () => number): {x,y,z}`

- [ ] **Step 1:** 12개 총기의 최신 수치와 방어구 흡수 규칙을 웹에서 조사한다. 반동 값은 근사값(`approx: true`)으로 넣는다. 첫 몇 발은 위로 올라가고 그 뒤로 좌우로 흔들리게 한다.
- [ ] **Step 2: 실패하는 테스트 작성** (테스트용 총기 객체는 조사 값과 상관없이 테스트 파일에서 직접 만든다)
  - `damage falloff`: `damage: [{maxRange:15, head:156, …}, {maxRange:30, head:140, …}, {maxRange:999, head:124, …}]`이면 `damageAt(w,'head',10)===156`, `20→140`, `40→124`, 경계값 `15→156`이다.
  - `armor absorbs`: `absorb: 1`(전부 흡수)일 때 `{hp:100, armor:50}`에 데미지 40을 주면 `{hp:100, armor:10}`이고, 다시 40을 주면 `{hp:70, armor:0}`이다. `absorb: 0.66`이면 데미지 30에서 방어구가 19.8, 체력이 10.2만큼 줄어든다. 체력이 0 이하가 되면 `killed: true`다.
  - `fire rate`: fireRate 10이면 `tryFire`를 0초와 0.05초에 부르면 첫 번째만 true, 0.1초에는 true다.
  - `semi auto needs re-press`: auto=false이면 누르고 있어도 두 번째 발이 나가지 않고, `triggerPressedThisFrame`이 true일 때만 나간다.
  - `magazine and auto reload`: 탄창 2발을 다 쏘면 자동으로 재장전이 시작되고, `reloadTime` 동안 `tryFire`가 false다.
  - `holding trigger through reload resumes auto fire`: 자동 총기로 계속 누르고 있으면 재장전이 끝난 뒤 다시 발사된다.
  - `firing error recovers`: 연속 5발을 쏜 뒤 `recovery`초가 지나면 `currentSpreadDeg`가 `spread.stand`로 돌아온다.
  - `stance spread`: `currentSpreadDeg(…, 'run')`이 `spread.run`이고, crouch는 `spread.crouch`다.
  - `sampleSpread within cone`: 10,000번 뽑아서 모든 결과와 원래 방향 사이의 각도가 `halfAngle` 이하이고, 결과가 원 안에 고르게 퍼져 있다(각도 제곱의 평균이 halfAngle²/2의 ±5%).
- [ ] **Step 3:** 실행한다. Expected: FAIL.
- [ ] **Step 4:** 구현한다. 순수 함수이고 `now`는 초 단위로 받는다. 반동 적용은 Task 9 사격 처리에서 카메라 pitch에 더하는 방식으로 하고, `weapon.js`는 이번 발의 반동 양만 돌려준다(`tryFire`가 true일 때 `s.lastRecoil = { pitch, yaw }`).
- [ ] **Step 5:** 실행한다. Expected: PASS.
- [ ] **Step 6:** Commit `feat: weapon data, fire/reload/spread/recoil and damage model`

### Task 8: 봇 모델 + 히트박스 + 애니메이션

**Files:**
- Create: `src/game/botModel.js`

**Interfaces:**
- Produces: `createBotModel(colors): { root: THREE.Group, hitboxes: THREE.Mesh[] /*userData.part = 'head'|'body'|'legs'*/, setPose({ strafeVel /*m/s, 오른쪽 +*/, crouch /*0~1*/, t }): void, headWorldPos(): THREE.Vector3, dispose() }`

- [ ] **Step 1:** 발로란트 요원 히트박스 크기(키, 머리 중심 높이, 머리 크기, 어깨 폭)를 웹에서 조사해서 상수로 넣고 출처를 주석으로 단다. 조사가 안 되면 키 1.8m, 머리 중심 1.6m, 머리 지름 0.25m를 쓴다.
- [ ] **Step 2:** Three.js 기본 도형(캡슐, 둥근 박스)으로 머리, 목, 상체, 골반, 팔(총을 든 자세), 다리를 계층 구조로 만든다. 독자 디자인의 전술 요원 느낌으로 하고, 헬멧이나 후드는 넣지 않는다. 총도 단순한 도형으로 만든다.
- [ ] **Step 3:** 히트박스는 보이지 않는 메시로 만든다(머리: 박스, 몸: 상체+골반 박스, 다리: 다리마다 박스). 해당 뼈에 붙여서 애니메이션을 따라가게 한다.
- [ ] **Step 4:** `setPose`는 절차적으로 만든다. strafe 속도에 비례해 다리를 앞뒤로 흔들고 상체를 진행 방향으로 살짝 기울인다(최대 6도). 앉기는 골반을 내리고 무릎을 굽힌다. 머리 히트박스는 항상 보이는 머리와 같은 위치에 있다.
- [ ] **Step 5:** 개발용 키(F9)로 봇 하나를 세워 디버그 히트박스 와이어프레임을 켜고, 자세가 바뀔 때 머리 판정이 머리에 붙어 있는지 수동으로 확인한다.
- [ ] **Step 6:** Commit `feat: humanoid bot model with animated hitboxes`

### Task 9: 사격 판정

**Files:**
- Create: `src/game/shooting.js`
- Test: `tests/shooting.test.js` (Three.js는 Node에서 렌더러 없이 동작하므로 Raycaster를 그대로 테스트한다)

**Interfaces:**
- Consumes: `sampleSpread`, `damageAt`, `createBotModel().hitboxes`, `buildWorld().meshes`
- Produces: `castShot({ origin: Vector3, dir: Vector3, worldMeshes, botHitboxes }): { part: 'head'|'body'|'legs'|null, point, distance }`, `aimedPart(origin, aimDir, botHitboxes, worldMeshes): part|null` (퍼짐 없이 조준점이 어디였는지 — "퍼짐 때문에 빗나간 발" 판정용)

- [ ] **Step 1: 실패하는 테스트 작성**
  - `head hit`: 머리 박스 정중앙을 향해 쏘면 `part === 'head'`다.
  - `wall in front blocks hitbox`: 봇과 플레이어 사이에 벽 박스를 두면 `part === null`이다.
  - `nearest hitbox wins`: 머리 앞에 팔/몸 박스가 겹치면 거리가 가까운 쪽 부위가 나온다.
  - `miss`: 하늘을 쏘면 `part === null`이다.
- [ ] **Step 2:** 실행한다. Expected: FAIL.
- [ ] **Step 3:** 구현한다. Raycaster 한 번에 `[...worldMeshes, ...botHitboxes]`를 넣고, 가장 가까운 교차점의 `userData.part`(벽이면 없음)를 돌려준다. `far = 100`.
- [ ] **Step 4:** 실행한다. Expected: PASS.
- [ ] **Step 5:** Commit `feat: raycast shot resolution`

### Task 10: 봇 피킹 상태 기계

**Files:**
- Create: `src/core/peek.js`
- Test: `tests/peek.test.js`

**Interfaces:**
- Consumes: `CoverPoint`, `DEFAULT_SETTINGS.peek`, `movement.json`(봇도 플레이어와 같은 속도와 가감속을 쓴다)
- Produces: `createPeekBot(cover: CoverPoint, cfg, M, rng): PeekBot`, `stepPeekBot(b: PeekBot, dt: number): void`. `PeekBot = { offset /*m, 숨은 위치에서 피킹 방향으로 나온 거리*/, vel, state: 'hidden'|'out'|'exposed'|'in', kind: 'short'|'wide', dirIndex, peekCount, exposedSince: number|null }`, 그리고 `botWorldPos(b, cover): {x,y,z}`

- [ ] **Step 1: 실패하는 테스트 작성** (rng는 시드를 고정한 함수)
  - `cycles until killed`: 30초를 계산하는 동안 `peekCount`가 10 이상이고, `state`는 hidden → out → exposed → in → hidden 순서로만 바뀐다.
  - `short vs wide distance`: short 피킹의 최대 `offset`은 `cover.shortDist`의 ±0.05m, wide는 `cover.wideDist`의 ±0.05m 안이다.
  - `wide ratio`: wideRatio 0.5로 1,000번 피킹하면 wide가 40–60%다.
  - `both directions`: `dirs`가 2개면 두 방향이 모두 나온다.
  - `moves at player speed`: 봇의 최대 속도가 `M.runSpeed`를 넘지 않는다.
- [ ] **Step 2:** 실행한다. Expected: FAIL.
- [ ] **Step 3:** 구현한다. 피킹 한 번마다 `kind`, 방향, 나와 있을 시간(`exposedTime` 범위), 숨어 있을 시간(`hiddenTime` 범위)을 rng로 정한다. 이동은 목표 offset을 향해 가속하고, 가까워지면 반대 방향으로 감속한다(A/D 카운터 스트레이핑처럼). `exposedSince`는 out 상태로 들어가는 순간의 시각이다.
- [ ] **Step 4:** 실행한다. Expected: PASS.
- [ ] **Step 5:** Commit `feat: bot ad-peek state machine (short/wide)`

### Task 11: 구간 분류 + 엄폐물 선택 + 기록 집계

**Files:**
- Create: `src/core/buckets.js`, `src/core/spawn.js`, `src/core/stats.js`
- Test: `tests/buckets.test.js`, `tests/spawn.test.js`, `tests/stats.test.js`; Modify: `tests/range.test.js`(skip 해제)

**Interfaces:**
- Produces:
  - `classifyBucket(playerFeet, botFeet, bucketsCfg): { d: 0|1|2|null, h: 0|1|2 }` — d는 수평+수직 직선 거리 기준이고, 범위 밖이면 null. h: 0 아래, 1 같음, 2 위.
  - `pickCover(covers, playerFeet, history: Array<{d,h}>, bucketsCfg, visible: (cover)=>boolean, rng): CoverPoint` — 보이는 지점 중에서 지금까지 가장 적게 나온 (d,h) 칸을 우선으로 고른다. 방금 쓴 지점은 제외한다.
  - `ShotRecord = { t, weapon, part, aimedPart, moving: boolean, distM, d, h, damage }`
  - `BotRecord = { mode, coverId, d, h, kind /*쓰러질 때의 피킹 종류*/, peekIndex, firstSeenAt, killedAt|null, placementErr: { v, h } /*도*/|null, shots: ShotRecord[], firstShot: part|null, failed: boolean }`
  - `summarize(bots: BotRecord[], headSizeDeg: (distM)=>number): Summary`, `Summary = { firstShotHeadRate, headRate, bodyRate, legsRate, avgKillTime, avgPlacement: {v,h}|null, spreadMisses, movingShots, oneTapRate, grid: Cell[3][3], weakest: {d,h}|null, peekSplit: { short:{headRate,avgKillTime}, wide:{…} } }`, `Cell = { n, headRate, avgKillTime }`

- [ ] **Step 1: 실패하는 테스트 작성**
  - `classifyBucket`: 거리 10m·높이 차 0이면 `{d:0,h:1}`, 20m·−3m이면 `{d:1,h:0}`, 40m·+2m이면 `{d:2,h:2}`, 60m이면 `d:null`, 경계 1.5m는 `h:1`(같음 포함)이다.
  - `pickCover balances`: 9칸에 각각 지점이 하나씩 있을 때 90번 고르면 칸마다 10 ±1번이다. `visible`이 false인 지점은 절대 나오지 않는다.
  - `summarize`: 직접 만든 BotRecord 4개로 `firstShotHeadRate`, `grid[d][h].n`, `weakest`(n ≥ 1인 칸 중 headRate가 가장 낮은 칸, 같으면 avgKillTime이 큰 칸), `spreadMisses`(aimedPart==='head'인데 part!=='head'인 발 수), `oneTapRate`(발 1개로 쓰러진 봇 비율)를 확인한다.
- [ ] **Step 2:** 실행한다. Expected: FAIL.
- [ ] **Step 3:** 구현한다.
- [ ] **Step 4:** `npm test`를 실행한다. Expected: 전체 PASS(range.test 포함).
- [ ] **Step 5:** Commit `feat: buckets, cover selection and session stats`

### Task 12: 세션 진행 — 모드 1(피킹 대응) + 모드 2(미세 조정)

**Files:**
- Create: `src/game/session.js`, `src/game/audio.js`

**Interfaces:**
- Consumes: Task 2–11 전부
- Produces: `createSession({ mode: 'peek'|'micro', weaponId, judge: 'head'|'kill', armor: 0|25|50, settings, ctx }): { update(dt, now), onFire(now): void, isDone(): boolean, records(): BotRecord[], hud(): { botsLeft, headRate, ammo, reloading } }`. `ctx`에는 scene, camera, look, player, world, input이 들어 있다.

- [ ] **Step 1: 모드 1을 구현한다.**
  - `pickCover`로 지점을 고르고, `coverHighlight`가 켜져 있으면 지점의 `edge`를 0.6초 동안 빛나게 한 다음 봇을 둔다.
  - 매 프레임 `stepPeekBot`을 돌리고 모델 위치와 자세를 맞춘다.
  - 각 피킹에서 머리가 플레이어 눈에서 처음 보이는 순간(머리 중심으로 레이를 쏴서 벽에 막히지 않는 첫 프레임)에 배치 오차를 기록한다. 카메라 정면 방향과 머리 방향 사이의 세로·가로 각도이고, 봇마다 첫 피킹 값을 `placementErr`로 저장한다.
  - 사격: `tryFire` → 자세 판정(공중 > 달리기(speedFraction>0.6) > 걷기(>0.3) > 앉기 > 서기) → `currentSpreadDeg` → `sampleSpread` → `castShot`, 그리고 `aimedPart`도 기록한다. `moving`은 speedFraction > 0.3이면 true다. 반동은 `look.pitch`에 더한다.
  - 판정이 `head`면 머리를 맞혔을 때 쓰러지고, `kill`이면 `applyDamage`로 체력이 0이 되면 쓰러진다. 쓰러지면 `nextBotDelay` 뒤에 다음 봇이 나온다. `botCount`명을 쓰러뜨리면 끝난다.
- [ ] **Step 2: 모드 2를 구현한다.** 시작 점(지름 0.1m의 빛나는 구)을 해당 칸 지점의 머리 높이 근처에 두는데, 머리 중심에서 `offsetDeg` 범위만큼 떨어진 방향(무작위)에 둔다. 조준선이 `holdTime` 동안 시작 점 위에 있으면 봇이 지점에 나타난다(봇은 `botStrafe`면 숏 피킹 거리 안에서 짧게 A/D를 하고, 숨지 않는다). `timeLimit`이 지나면 `failed: true`로 하고 다음으로 넘어간다.
- [ ] **Step 3:** `audio.js`를 만든다. WebAudio로 사격음, 헤드음(높은 금속음), 몸샷음(낮은 둔탁음)을 합성하고, `audio.enabled`와 `volume`을 따른다.
- [ ] **Step 4:** 개발 단축키(F10)로 Vandal, 모드 1, 봇 5명 세션을 바로 시작한다. **수동 확인:** 봇이 숏/와이드 피킹을 반복하는지, 헤드 판정이면 몸을 맞혀도 쓰러지지 않는지, 처치 판정에 중량 방어구면 Vandal 몸샷 4발에 쓰러지는지(조사한 수치에 따라 계산한 발 수)를 본다.
- [ ] **Step 5:** Commit `feat: peek and micro-adjust session modes`

### Task 13: 메뉴·HUD·일시정지·결과 화면·결과 저장

**Files:**
- Create: `src/ui/menu.js`, `src/ui/hud.js`, `src/ui/results.js`; Modify: `src/game/app.js`, `src/ui/style.css`, `index.html`

**Interfaces:**
- Consumes: `createSession`, `summarize`, `window.api`, `cmPer360`
- Produces: 화면 상태 `'menu'|'playing'|'paused'|'results'`

- [ ] **Step 1:** 메인 메뉴를 만든다. 모드(피킹 대응 / 미세 조정), 총기 12종, 판정 방식(헤드 전용 / 처치), 방어구(없음 / 경량 25 / 중량 50, 처치일 때만 선택 가능)를 고른다. 현재 감도와 "한 바퀴 42.1cm" 형식의 cm/360을 표시하고, 시작·설정·종료 버튼을 둔다. 선택은 `settings.last`에 저장해서 다음 실행에 다시 채운다. 원본 입력이 지원되지 않으면(`'fallback'`) 경고를 표시한다.
- [ ] **Step 2:** 설정 화면을 만든다. DPI, 감도, 한 판 봇 수, 엄폐물 표시, 숏/와이드 비율, 소리를 바꿀 수 있다. 나머지 항목은 `settings.json`을 직접 고쳐서 바꾼다(프리셋 UI는 범위 밖).
- [ ] **Step 3:** HUD를 만든다. 아래 가운데에 탄약/탄창과 재장전 표시, 위 가운데에 남은 봇 수와 헤드샷 비율, 오른쪽 위에 FPS를 둔다.
- [ ] **Step 4:** 일시정지를 만든다. Esc를 누르거나 포인터 잠금이 풀리면(Alt+Tab 포함) 즉시 `paused`로 바뀌고 계속 / 끝내고 결과 보기 / 메인으로를 고른다. 일시정지 중에는 세션 시간이 흐르지 않는다(봇, 타이머 정지). 계속하면 잠금을 다시 건다.
- [ ] **Step 5:** 결과 화면을 만든다. 첫 발 헤드샷 비율을 가장 크게 보여 주고, 나머지 요약 항목, 3×3 표(가로: 아래/같음/위, 세로: 가까움/중간/멂, 가장 약한 칸 강조), 숏 vs 와이드, 처치 판정이면 원탭 비율을 표시한다. 배치 오차는 "도"와 "머리 n개"(봇까지 평균 거리에서의 머리 각도 크기로 나눈 값)로 표시한다. 다시 하기와 메인으로 버튼을 둔다. 결과 JSON을 `saveSession`으로 저장한다.
- [ ] **Step 6:** 처음부터 끝까지 수동으로 확인한다: 메뉴 → 모드 1 → Alt+Tab(일시정지 확인) → 계속 → 끝까지 → 결과 → 저장 파일 확인 → 다시 실행해서 마지막 선택이 남아 있는지 확인.
- [ ] **Step 7:** Commit `feat: menus, hud, pause and results`

### Task 14: 설치 파일 + 성능 확인

**Files:**
- Create: `electron-builder.yml`, `build/icon.ico`; Modify: `package.json`

- [ ] **Step 1:** electron-builder를 설정한다. Windows `nsis`(바탕화면 바로가기 생성, 설치 경로 선택 가능)와 `portable`을 만들고, `appId: com.local.headline-aim`, `productName: Headline Aim`으로 한다. 아이콘은 직접 만든 단순한 조준선 모양이다.
- [ ] **Step 2:** `npm run dist`를 실행한다. Expected: `release/` 아래에 설치 exe와 포터블 exe가 생긴다.
- [ ] **Step 3:** 설치본으로 실행해서 확인한다. 모드 1 한 판 동안 FPS가 계속 165 이상인지(HUD 확인), 포인터 원본 입력 경고가 없는지, 설정과 결과 파일이 `%APPDATA%/Headline Aim/`에 생기는지 본다.
- [ ] **Step 4:** `npm test` 전체를 실행한다. Expected: 모두 PASS.
- [ ] **Step 5:** Commit `chore: windows installer`
