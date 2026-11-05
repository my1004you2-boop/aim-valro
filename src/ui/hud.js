import { pct } from './format.js';
import { createInputOverlay } from './inputOverlay.js';

export const BRAKE_LABEL = {
  still: '정지 사격',
  braked: '톡 브레이킹',
  coasted: '만세 브레이킹',
  moving: '이동 중 사격',
  overheld: '반대로 미끄러짐',
};
const SHOW_FOR = 0.7;

// 쏜 순간의 이동 상태: 초록(톡) / 하늘(만세) / 흰(정지) / 빨강(이동 중) / 주황(반대로 미끄러짐)
const BRAKE_CLASS = { still: 'ok', braked: 'tok', coasted: 'manse', moving: 'bad', overheld: 'over' };

function brakeText(s) {
  const stop = s.stopMs != null ? ` · 정지 ${s.stopMs}ms` : '';
  const extra = s.sinceStopMs != null ? `${stop} · 멈추고 ${s.sinceStopMs}ms 후 사격` : !s.accurate ? ` · 속도 ${Math.round(s.speed * 100)}%` : '';
  return `${BRAKE_LABEL[s.kind]}${extra}${s.voided ? ' · 무효' : ''}`;
}

// 속도 막대: 최고 속도 대비 지금 속도, 데드존 선, 데드존 안인지
export function speedMeter(speed, deadzone) {
  return { fill: Math.min(1, speed), mark: deadzone, inZone: speed <= deadzone };
}

export function createHud(root, { brakeIndicator = true, speedBar = true, inputOverlay = true, keys = null } = {}) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `<div class="hurt" id="hurt"></div>
    <div class="top"><span>남은 봇 <b id="left"></b></span><span id="waveBox">웨이브 <b id="wave"></b> · 이번 웨이브 <b id="waveLeft"></b>명</span><span>헤드샷 <b id="hr"></b></span></div>
    <div class="vitals" id="vitals"><span class="hp" id="hp"></span><span class="ar" id="ar"></span></div>
    <div class="slots" id="slots"></div>
    <div class="ammo"><div class="w" id="wname"></div><span class="n" id="ammo"></span> <span class="m" id="mag"></span><div class="reload" id="reload"></div></div>
    <div class="dead" id="dead">사망 — 다음 봇으로 넘어갑니다</div>
    <div class="speedbar" id="speedbar"><div class="fill" id="speedfill"></div><div class="mark" id="speedmark"></div></div>
    <div class="brake" id="brake"></div>
    <div class="strafe" id="strafe"></div>
    <div class="clickhint" id="click">클릭해서 시작</div>`;
  root.replaceChildren(el);
  const $ = (id) => el.querySelector(`#${id}`);
  const overlay = inputOverlay && keys ? createInputOverlay(el, keys) : null;
  let last = '';
  return {
    // pressed = { keys: 누르고 있는 키 코드 Set, left, right: 마우스 버튼 }
    update(h, locked, pressed = null) {
      if (overlay && pressed) overlay.update(pressed.keys, pressed);
      // 피격 테두리는 매 프레임 서서히 사라진다.
      $('hurt').style.opacity = h.botFire ? Math.max(0, 0.75 - h.hurtAgo * 1.5) : 0;
      const sb = $('speedbar');
      sb.style.display = speedBar && h.speed != null ? 'block' : 'none';
      if (speedBar && h.speed != null) {
        const m = speedMeter(h.speed, h.deadzone);
        $('speedfill').style.width = `${m.fill * 100}%`;
        $('speedmark').style.left = `${m.mark * 100}%`;
        sb.classList.toggle('in', m.inZone);
      }
      const b = $('brake');
      if (brakeIndicator && h.lastShot && h.sinceShot < SHOW_FOR) {
        const text = brakeText(h.lastShot);
        if (b.textContent !== text) b.textContent = text;
        b.className = `brake ${BRAKE_CLASS[h.lastShot.kind]}`;
        b.style.opacity = Math.min(1, (SHOW_FOR - h.sinceShot) * 4);
      } else b.style.opacity = 0;
      const st = $('strafe');
      st.textContent = !h.strafe ? '' : h.strafe.cue ? '신호! 브레이킹 후 헤드' : h.strafe.running ? '달리는 중… 신호를 기다리세요' : 'A / D 로 좌우로 달리세요';
      st.className = `strafe${h.strafe?.cue ? ' cue' : ''}`;
      const key = `${h.botsLeft}|${h.headRate}|${h.ammo}|${h.reloading}|${locked}|${h.slot}|${h.hp}|${h.armor}|${h.dead}|${h.wave?.index}|${h.wave?.left}`;
      if (key === last) return;
      last = key;
      $('left').textContent = h.botsLeft;
      $('waveBox').style.display = h.wave ? 'inline' : 'none';
      if (h.wave) {
        $('wave').textContent = h.wave.index;
        $('waveLeft').textContent = h.wave.left;
      }
      $('hr').textContent = pct(h.headRate);
      $('wname').textContent = h.weapon.toUpperCase();
      $('ammo').textContent = h.melee ? '' : h.infiniteAmmo ? '∞' : h.ammo;
      $('mag').textContent = h.melee || h.infiniteAmmo ? '' : `/ ${h.magazine}`;
      $('reload').textContent = h.reloading ? '재장전 중…' : '';
      $('slots').innerHTML = h.slots.map((s) => `<span class="${s.active ? 'on' : ''}"><i>${s.key}</i>${s.name}</span>`).join('');
      $('vitals').style.display = h.botFire ? 'flex' : 'none';
      $('hp').textContent = Math.max(0, Math.round(h.hp));
      $('ar').textContent = Math.round(h.armor);
      $('dead').style.display = h.dead ? 'block' : 'none';
      $('click').style.display = locked ? 'none' : 'block';
    },
  };
}
