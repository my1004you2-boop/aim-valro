// 총기 상태: 연사 간격, 자동/반자동, 탄창·재장전, 연속 사격 오차, 반동. 시간은 초 단위.
export function createWeaponState(w, rng = Math.random) {
  return {
    ammo: w.magazine,
    nextShotAt: 0,
    reloadingUntil: null,
    errAtShot: 0,
    lastShotAt: -Infinity,
    lastRecoil: { pitch: 0, yaw: 0 },
    rng,
  };
}

export function startReload(s, w, now) {
  if (s.reloadingUntil !== null || s.ammo >= w.magazine) return;
  s.reloadingUntil = now + w.reloadTime;
}

export function updateWeapon(s, w, now) {
  if (s.reloadingUntil !== null && now >= s.reloadingUntil - 1e-9) {
    s.ammo = w.magazine;
    s.reloadingUntil = null;
  }
}

function firingError(s, w, now) {
  const k = 1 - (now - s.lastShotAt) / w.firingError.recovery;
  return k > 0 ? s.errAtShot * k : 0;
}

export function currentSpreadDeg(s, w, stance, now) {
  return w.spread[stance] + firingError(s, w, now);
}

export function tryFire(s, w, now, triggerHeld, triggerPressedThisFrame) {
  if (s.reloadingUntil !== null) return false;
  if (s.ammo <= 0) {
    startReload(s, w, now);
    return false;
  }
  if (!(w.auto ? triggerHeld : triggerPressedThisFrame)) return false;
  if (now < s.nextShotAt - 1e-9) return false;

  s.errAtShot = Math.min(w.firingError.max, firingError(s, w, now) + w.firingError.perShot);
  s.lastShotAt = now;
  s.nextShotAt = now + 1 / w.fireRate;
  s.ammo--;
  s.lastRecoil = { pitch: w.recoil.pitchPerShot, yaw: (s.rng() * 2 - 1) * w.recoil.yawJitter };
  if (s.ammo === 0) startReload(s, w, now);
  return true;
}
