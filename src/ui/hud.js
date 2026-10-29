import { pct } from './format.js';

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `<div class="top"><span>남은 봇 <b id="left"></b></span><span>헤드샷 <b id="hr"></b></span></div>
    <div class="ammo"><div class="w" id="wname"></div><span class="n" id="ammo"></span> <span class="m" id="mag"></span><div class="reload" id="reload"></div></div>
    <div class="clickhint" id="click">클릭해서 시작</div>`;
  root.replaceChildren(el);
  const $ = (id) => el.querySelector(`#${id}`);
  let last = '';
  return {
    update(h, locked) {
      const key = `${h.botsLeft}|${h.headRate}|${h.ammo}|${h.reloading}|${locked}`;
      if (key === last) return;
      last = key;
      $('left').textContent = h.botsLeft;
      $('hr').textContent = pct(h.headRate);
      $('wname').textContent = h.weapon.toUpperCase();
      $('ammo').textContent = h.ammo;
      $('mag').textContent = `/ ${h.magazine}`;
      $('reload').textContent = h.reloading ? '재장전 중…' : '';
      $('click').style.display = locked ? 'none' : 'block';
    },
  };
}
