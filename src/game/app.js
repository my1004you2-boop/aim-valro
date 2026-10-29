import * as THREE from 'three';
import { createInput } from './input.js';
import { createLook } from './look.js';
import { buildWorld } from './world.js';
import { createSession } from './session.js';
import { createAudio } from './audio.js';
import { createCrosshairOverlay } from './crosshairView.js';
import { verticalFovDeg } from '../core/fov.js';
import { parseCrosshairCode } from '../core/crosshair.js';
import { parseSettingsText } from '../core/settings.js';
import { createPlayer, stepPlayer, eyeHeight } from '../core/physics.js';
import { summarize } from '../core/stats.js';
import { headSizeDeg } from '../core/aim.js';
import { renderMenu, renderSettings, renderPause } from '../ui/menu.js';
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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a3140');
  scene.fog = new THREE.Fog('#2a3140', 70, 160);
  scene.add(new THREE.HemisphereLight('#e3ebff', '#2b2f38', 1.3));
  const sun = new THREE.DirectionalLight('#fff4e6', 1.4);
  sun.position.set(20, 40, 15);
  scene.add(sun);
  const world = buildWorld(scene, range);

  const camera = new THREE.PerspectiveCamera(70.53, 1, 0.03, 300);
  camera.rotation.order = 'YXZ';
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = verticalFovDeg(settings.hfov, camera.aspect);
    camera.updateProjectionMatrix();
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

  const eye = () => new THREE.Vector3(player.pos.x, player.pos.y + eyeHeight(player, M), player.pos.z);
  const saveSettings = () => api.saveSettings(JSON.stringify(settings, null, 2));

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
      weaponId: choice.weapon,
      judge: choice.judge,
      armor: choice.judge === 'kill' ? choice.armor : 0,
      settings,
      covers: range.covers,
      ctx: { scene, look, player, world, input, M, weapons, armorRules, audio, eye },
    });
    session.setDebug(debug);
    hud = createHud(ui);
    crosshair.setVisible(true);
    state = 'playing';
    input.requestLock();
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    renderPause(ui, {
      onResume() {
        hud = createHud(ui);
        state = 'playing';
        input.requestLock();
      },
      onEnd: showResults,
      onMenu: showMenu,
    });
  }

  function showResults() {
    state = 'results';
    input.exitLock();
    crosshair.setVisible(false);
    const records = session.records();
    const summary = summarize(records, headSizeDeg);
    const meta = { mode: sel.mode, weapon: sel.weapon, weaponName: weapons[sel.weapon].name, judge: sel.judge, armor: sel.judge === 'kill' ? sel.armor : 0 };
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
  canvas.addEventListener('click', () => {
    if (state === 'playing' && !input.locked) input.requestLock();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F9') {
      debug = !debug;
      session?.setDebug(debug);
    }
    if (e.code === 'F10' && state === 'menu') {
      startSession({ mode: 'peek', weapon: 'vandal', judge: 'head', armor: 0 });
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

    if (state === 'playing' && (input.locked || DEV_NO_LOCK)) {
      const { dx, dy } = input.consumeMouse();
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
        weapons[sel.weapon].moveSpeedMul,
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
    if (state === 'playing' && hud) hud.update(session.hud(), input.locked);
    renderer.render(scene, camera);
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
