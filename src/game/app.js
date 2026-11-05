import * as THREE from 'three';
import { createInput } from './input.js';
import { createLook } from './look.js';
import { buildWorld } from './world.js';
import { createSession } from './session.js';
import { createAudio } from './audio.js';
import { createCrosshairOverlay } from './crosshairView.js';
import { createViewmodel } from './viewmodel.js';
import { verticalFovDeg } from '../core/fov.js';
import { parseCrosshairCode } from '../core/crosshair.js';
import { parseSettingsText } from '../core/settings.js';
import { createPlayer, stepPlayer, eyeHeight, speedFraction } from '../core/physics.js';
import { summarize } from '../core/stats.js';
import { headSizeDeg } from '../core/aim.js';
import { renderMenu, renderSettings, renderPause, renderShop } from '../ui/menu.js';
import { createHud } from '../ui/hud.js';
import { renderResults } from '../ui/results.js';
import { sessionFileName } from '../ui/format.js';
import M from '../../data/movement.json';
import weaponData from '../../data/weapons.json';
import armorRules from '../../data/armor.json';
import range from '../../data/range.json';

// 개발용: index.html#dev-nolock 이면 포인터 잠금 없이도 게임 시간이 흐른다(자동 화면 확인용).
const DEV_NO_LOCK = location.hash === '#dev-nolock';

const api = window.api ?? {
  loadSettings: async () => null,
  saveSettings: async () => {},
  saveSession: async () => {},
  quit: async () => window.close(),
};

export async function startApp(canvas) {
  let settings = parseSettingsText(await api.loadSettings());
  const weapons = weaponData.weapons;
  const knife = weaponData.melee.knife;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb3c4');
  scene.fog = new THREE.Fog('#9fb3c4', 60, 140);
  scene.add(new THREE.HemisphereLight('#dfe9f5', '#5a5248', 1.25));
  const sun = new THREE.DirectionalLight('#fff0dc', 1.7);
  sun.position.set(-18, 40, 12);
  scene.add(sun);
  const world = buildWorld(scene, range);

  const camera = new THREE.PerspectiveCamera(70.53, 1, 0.03, 300);
  camera.rotation.order = 'YXZ';
  const viewmodel = createViewmodel();
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = verticalFovDeg(settings.hfov, camera.aspect);
    camera.updateProjectionMatrix();
    viewmodel.setAspect(camera.aspect);
  };
  window.addEventListener('resize', resize);
  resize();

  const crosshair = createCrosshairOverlay(document.getElementById('overlay'), parseCrosshairCode(settings.crosshairCode));
  const ui = document.getElementById('ui');
  const input = createInput(canvas);
  const look = createLook({ sens: settings.mouse.sens });
  const audio = createAudio(settings);
  let player = createPlayer(range.spawn);

  let state = 'menu';
  let session = null;
  let sel = null;
  let hud = null;
  let gameNow = 0;
  let debug = false;
  let gunShown = null;

  const eye = () => new THREE.Vector3(player.pos.x, player.pos.y + eyeHeight(player, M), player.pos.z);
  const saveSettings = () => api.saveSettings(JSON.stringify(settings, null, 2));
  // 총알 궤적 시작점: 화면에 보이는 총구 위치에서 0.6m 앞
  const muzzle = () => {
    const e = eye();
    camera.position.copy(e);
    camera.rotation.set(look.pitch, look.yaw, 0);
    camera.updateMatrixWorld();
    const ndc = viewmodel.muzzleNdc();
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(e).normalize();
    return e.addScaledVector(dir, 0.6);
  };

  function resetPlayer() {
    player = createPlayer(range.spawn);
    look.yaw = range.spawn.yaw;
    look.pitch = 0;
  }

  function showMenu() {
    state = 'menu';
    input.exitLock();
    session?.dispose();
    session = null;
    crosshair.setVisible(false);
    renderMenu(ui, {
      settings,
      weapons,
      rawInput: input.rawSupported,
      onStart: startSession,
      onSettings: showSettings,
      onQuit: () => api.quit(),
    });
  }

  function showSettings() {
    renderSettings(ui, {
      settings,
      onSave(next) {
        settings = next;
        look.sens = settings.mouse.sens;
        crosshair.set(parseCrosshairCode(settings.crosshairCode));
        saveSettings();
        showMenu();
      },
      onBack: showMenu,
    });
  }

  function startSession(choice) {
    sel = choice;
    settings.last = { ...choice };
    saveSettings();
    audio.unlock();
    session?.dispose();
    resetPlayer();
    gameNow = 0;
    session = createSession({
      mode: choice.mode,
      loadout: { primary: choice.primary, secondary: choice.secondary },
      judge: choice.judge,
      armor: choice.judge === 'kill' ? choice.armor : 0,
      botFire: choice.botFire,
      brakeJudge: !!choice.brakeJudge,
      settings,
      walls: range.walls,
      ctx: { scene, look, player, world, input, M, weapons, knife, armorRules, audio, eye, muzzle },
    });
    gunShown = choice.primary;
    viewmodel.setWeapon(choice.primary);
    session.setDebug(debug);
    hud = createHud(ui, { brakeIndicator: settings.brake.indicator, speedBar: settings.brake.speedBar, inputOverlay: settings.display.inputOverlay, keys: settings.keys });
    crosshair.setVisible(true);
    state = 'playing';
    lockOrPause();
  }

  // 잠금이 거부되면(Esc 직후 등) 일시정지 메뉴로 돌아가 다시 시도할 수 있게 한다.
  // 버튼 클릭이 document 클릭으로도 전달되므로, 진행 중인 요청이 있으면 다시 보내지 않는다.
  let lockPending = false;
  async function lockOrPause() {
    if (lockPending) return;
    lockPending = true;
    const result = await input.requestLock();
    lockPending = false;
    if (result === 'failed' && state === 'playing' && !input.locked) pause();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    renderPause(ui, {
      onResume() {
        hud = createHud(ui, { brakeIndicator: settings.brake.indicator, speedBar: settings.brake.speedBar, inputOverlay: settings.display.inputOverlay, keys: settings.keys });
        state = 'playing';
        lockOrPause();
      },
      onEnd: showResults,
      onMenu: showMenu,
    });
  }

  // 무기 교환 창: 잠금을 풀고 시간을 멈춘다(일시정지 메뉴는 띄우지 않는다).
  function openShop() {
    if (state !== 'playing') return;
    state = 'shop';
    input.exitLock();
    renderShop(ui, {
      weapons,
      loadout: session.loadout(),
      onBuy(slot, id) {
        session.buy(slot, id, gameNow);
        sel[slot] = id;
      },
      onClose: closeShop,
    });
  }

  function closeShop() {
    if (state !== 'shop') return;
    hud = createHud(ui, { brakeIndicator: settings.brake.indicator, speedBar: settings.brake.speedBar, inputOverlay: settings.display.inputOverlay, keys: settings.keys });
    state = 'playing';
    lockOrPause();
  }

  function showResults() {
    state = 'results';
    input.exitLock();
    crosshair.setVisible(false);
    const records = session.records();
    const summary = summarize(records, headSizeDeg);
    const meta = {
      mode: sel.mode, primary: sel.primary, secondary: sel.secondary,
      weaponName: `${weapons[sel.primary].name} / ${weapons[sel.secondary].name}`,
      judge: sel.judge, armor: sel.judge === 'kill' ? sel.armor : 0, botFire: sel.botFire, brakeJudge: !!sel.brakeJudge,
    };
    session.dispose();
    session = null;
    const view = renderResults(ui, { summary, meta, onRetry: () => startSession(sel), onMenu: showMenu });
    const date = new Date();
    const name = sessionFileName(date, sel.mode);
    api
      .saveSession(name, JSON.stringify({ date: date.toISOString(), meta, settings, summary, records }, null, 1))
      .then(() => view.setSaved(`결과 저장됨: sessions/${name}`))
      .catch(() => view.setSaved('결과를 저장하지 못했습니다.'));
  }

  input.onLockChange((locked) => {
    if (!locked) pause();
  });
  document.addEventListener('click', () => {
    if (state === 'playing' && !input.locked) lockOrPause();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F9') {
      debug = !debug;
      session?.setDebug(debug);
    }
    if (e.code === 'KeyB') {
      if (state === 'playing') openShop();
      else if (state === 'shop') closeShop();
    }
    if (e.code === 'Escape' && state === 'shop') closeShop();
    if (e.code === 'F10' && state === 'menu') {
      startSession({ mode: 'peek', primary: 'vandal', secondary: 'classic', judge: 'head', armor: 0, botFire: 'off', brakeJudge: false });
    }
  });

  const fpsEl = document.getElementById('fps');
  let frames = 0;
  let fpsT = performance.now();
  let last = performance.now();

  renderer.setAnimationLoop(() => {
    const t = performance.now();
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;

    let mouse = { dx: 0, dy: 0 };
    if (state === 'playing' && (input.locked || DEV_NO_LOCK)) {
      const { dx, dy } = input.consumeMouse();
      mouse = { dx, dy };
      look.applyMouse(dx, dy, true);
      const k = settings.keys;
      const has = (code) => input.keys.has(code);
      stepPlayer(
        player,
        {
          wishX: (has(k.right) ? 1 : 0) - (has(k.left) ? 1 : 0),
          wishZ: (has(k.forward) ? 1 : 0) - (has(k.back) ? 1 : 0),
          yaw: look.yaw,
          walk: has(k.walk),
          crouch: has(k.crouch),
          jump: has(k.jump),
        },
        world.boxes,
        dt,
        M,
        session.hud().moveSpeedMul,
      );
      gameNow += dt;
      session.update(dt, gameNow);
      if (session.isDone()) showResults();
    } else {
      input.consumeMouse();
    }

    const e = eye();
    camera.position.copy(e);
    camera.rotation.set(look.pitch, look.yaw, 0);
    const showGun = session && (state === 'playing' || state === 'paused' || state === 'shop');
    if (state === 'playing' && hud) hud.update(session.hud(), input.locked, { keys: input.keys, left: input.mouseDown, right: input.rightDown });
    if (showGun) {
      const h = session.hud();
      if (h.weaponId !== gunShown) {
        gunShown = h.weaponId;
        viewmodel.setWeapon(h.weaponId);
      }
      viewmodel.update(state === 'playing' ? dt : 0, {
        now: gameNow,
        shotAt: h.shotAt,
        reloadProgress: h.reloadProgress,
        speed: player.onGround ? Math.min(1, speedFraction(player, M)) : 0,
        dx: mouse.dx,
        dy: mouse.dy,
      });
    }
    audio.setListener(e, look.forward());
    renderer.clear();
    renderer.render(scene, camera);
    if (showGun) {
      renderer.clearDepth();
      renderer.render(viewmodel.scene, viewmodel.camera);
    }
    input.endFrame();

    frames++;
    if (t - fpsT >= 500) {
      fpsEl.textContent = `${Math.round((frames * 1000) / (t - fpsT))} FPS`;
      frames = 0;
      fpsT = t;
    }
  });

  resetPlayer();
  showMenu();
}
