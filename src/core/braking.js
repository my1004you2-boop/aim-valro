// 브레이킹(카운터 스트레이핑) 판정. 매 프레임 이동 속도와 누른 방향을 넣고, 쏠 때 그 순간을 분류한다.
// 종류: still(원래 서 있음) · braked(톡 브레이킹: 반대 키로 멈춤) · coasted(만세 브레이킹: 키만 떼서 멈춤)
//      · moving(아직 움직이는 중) · overheld(반대 키를 너무 오래 눌러 반대로 움직이는 중)
const STILL_AFTER = 1.0; // 마지막으로 빨랐던 때부터 이만큼 지나면 원래 서 있던 것으로 본다(초)
const OVERHELD_WINDOW = 0.6; // 멈춘 뒤 이 시간 안에 반대로 빨라지면 반대 키를 너무 오래 누른 것
const COUNTER_BEFORE_STOP = 0.3; // 멈추기 직전 이 시간 안에 반대 키를 눌렀으면 브레이킹

export function createBrakeTracker() {
  return {
    speed: 0,
    vel: { x: 0, z: 0 },
    wasFast: false,
    fastDir: { x: 0, z: 0 },
    lastFastAt: -Infinity,
    stopAt: null,
    stopDir: { x: 0, z: 0 },
    counterAt: -Infinity,
    brakeFrom: null, // 달리던 방향 키를 놓은(또는 반대 키를 누른) 순간
    stopMs: null, // 그때부터 멈추기까지 걸린 시간
  };
}

const unit = (v) => {
  const l = Math.hypot(v.x, v.z);
  return l > 1e-6 ? { x: v.x / l, z: v.z / l } : { x: 0, z: 0 };
};

/** vel: 수평 속도(m/s), wish: 누른 이동 방향(월드 좌표, 크기 무관) */
export function stepBrake(t, { vel, wish, now }, M) {
  t.vel = { x: vel.x, z: vel.z };
  t.speed = Math.hypot(vel.x, vel.z) / M.runSpeed;
  const fast = t.speed > M.accurateSpeedFraction;
  if (fast) {
    // 움직이는 방향과 반대로 키를 누르고 있다 = 브레이킹 중
    const push = vel.x * wish.x + vel.z * wish.z;
    if (push < 0) t.counterAt = now;
    if (push > 0) t.brakeFrom = null;
    else if (t.brakeFrom === null) t.brakeFrom = now;
    t.fastDir = unit(vel);
    t.lastFastAt = now;
  } else if (t.wasFast) {
    t.stopAt = now;
    t.stopDir = t.fastDir;
    t.stopMs = t.brakeFrom === null ? null : Math.round((now - t.brakeFrom) * 1000);
    t.brakeFrom = null;
  }
  t.wasFast = fast;
}

export function classifyShot(t, now, M) {
  const speed = t.speed;
  const accurate = speed <= M.accurateSpeedFraction;
  const sinceStop = t.stopAt === null ? null : now - t.stopAt;
  if (!accurate) {
    const reversed = sinceStop !== null && sinceStop < OVERHELD_WINDOW && t.vel.x * t.stopDir.x + t.vel.z * t.stopDir.z < 0;
    return { kind: reversed ? 'overheld' : 'moving', accurate, speed, sinceStopMs: null, stopMs: null };
  }
  if (now - t.lastFastAt > STILL_AFTER || sinceStop === null) return { kind: 'still', accurate, speed, sinceStopMs: null, stopMs: null };
  const braked = t.counterAt >= t.stopAt - COUNTER_BEFORE_STOP;
  return { kind: braked ? 'braked' : 'coasted', accurate, speed, sinceStopMs: Math.round(sinceStop * 1000), stopMs: t.stopMs };
}
