// WebAudio로 합성한 효과음. 첫 사용자 입력 이후에 소리가 난다.

// 총소리: 잡음 층(필터 종류, 주파수, Q, 음량, 감쇠 시간 초) + 저음 '쿵'(시작 Hz, 끝 Hz, 길이, 음량)
const n = (type, hz, q, gain, decay) => ({ type, hz, q, gain, decay });
export const SHOT_PROFILES = {
  pistol: {
    layers: [n('bandpass', 2600, 0.9, 0.7, 0.045), n('lowpass', 1800, 0.7, 0.45, 0.11), n('lowpass', 900, 0.5, 0.12, 0.32)],
    thump: [170, 60, 0.08, 0.45],
  },
  heavyPistol: {
    layers: [n('bandpass', 2000, 0.8, 0.85, 0.06), n('lowpass', 1300, 0.7, 0.8, 0.2), n('lowpass', 650, 0.5, 0.28, 0.65)],
    thump: [110, 38, 0.17, 0.95],
  },
  smg: {
    layers: [n('bandpass', 3300, 1.1, 0.6, 0.032), n('lowpass', 2300, 0.7, 0.4, 0.07), n('lowpass', 1000, 0.5, 0.08, 0.2)],
    thump: [190, 75, 0.055, 0.3],
  },
  rifle: {
    layers: [n('bandpass', 2300, 0.9, 0.8, 0.05), n('lowpass', 1350, 0.7, 0.7, 0.14), n('lowpass', 700, 0.5, 0.2, 0.45)],
    thump: [125, 45, 0.12, 0.8],
  },
  marksman: {
    layers: [n('bandpass', 2100, 0.9, 0.85, 0.055), n('lowpass', 1200, 0.7, 0.75, 0.17), n('lowpass', 620, 0.5, 0.26, 0.6)],
    thump: [115, 40, 0.15, 0.9],
  },
  lmg: {
    layers: [n('bandpass', 2400, 0.9, 0.7, 0.045), n('lowpass', 1250, 0.7, 0.65, 0.12), n('lowpass', 650, 0.5, 0.16, 0.35)],
    thump: [105, 40, 0.11, 0.85],
  },
  // 소음기: 날카로운 파열음 없이 '퓩' 하는 소리 + 노리쇠 금속음
  suppressed: {
    layers: [n('bandpass', 950, 1.2, 0.5, 0.075), n('highpass', 5500, 0.7, 0.12, 0.018), n('lowpass', 700, 0.5, 0.05, 0.14)],
    thump: [140, 60, 0.05, 0.22],
  },
};

export function createAudio(settings) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new AudioContext();
      // 연사할 때 소리가 겹쳐 깨지지 않도록 압축기를 거친다.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(ctx.destination);
      master = ctx.createGain();
      master.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    master.gain.value = settings.audio.enabled ? settings.audio.volume : 0;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function env(c, gain, attack, decay, at, out = master) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    g.connect(out);
    return g;
  }

  function noise({ type, hz, q, gain, decay }, { rate = 1, delay = 0, sweepTo = null, out = master } = {}) {
    const c = ensure();
    const at = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(hz, at);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + decay);
    f.Q.value = q;
    src.connect(f).connect(env(c, gain, 0.002, decay, at, out));
    src.start(at, Math.random() * 0.5);
    src.stop(at + decay + 0.05);
  }

  function tone(freq, endFreq, dur, gain, { type = 'sine', delay = 0, attack = 0.002, out = master } = {}) {
    const c = ensure();
    const at = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), at + attack + dur);
    o.connect(env(c, gain, attack, dur, at, out));
    o.start(at);
    o.stop(at + attack + dur + 0.05);
  }

  // 종소리: 비정수배 배음을 섞어 금속성으로 들리게 한다.
  function bell(freq, dur, gain, delay = 0) {
    [[1, 1], [2.76, 0.45], [5.4, 0.2]].forEach(([mul, g]) => tone(freq * mul, freq * mul, dur / mul ** 0.5, gain * g, { delay }));
  }

  // 3D 위치 소리: 듣는 사람(플레이어) 기준으로 방향과 거리가 들린다.
  function panner(pos) {
    const c = ensure();
    const p = new PannerNode(c, {
      panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 4, rolloffFactor: 1.1, maxDistance: 80,
      positionX: pos.x, positionY: pos.y + 0.1, positionZ: pos.z,
    });
    p.connect(master);
    setTimeout(() => p.disconnect(), 500);
    return p;
  }

  let stepAlt = false;
  return {
    unlock: ensure,
    // 매 프레임 플레이어 귀 위치와 바라보는 방향을 알려준다.
    setListener(pos, forward) {
      if (!ctx) return;
      const l = ctx.listener;
      const t = ctx.currentTime;
      if (l.positionX) {
        l.positionX.setValueAtTime(pos.x, t);
        l.positionY.setValueAtTime(pos.y, t);
        l.positionZ.setValueAtTime(pos.z, t);
        l.forwardX.setValueAtTime(forward.x, t);
        l.forwardY.setValueAtTime(forward.y, t);
        l.forwardZ.setValueAtTime(forward.z, t);
        l.upX.setValueAtTime(0, t);
        l.upY.setValueAtTime(1, t);
        l.upZ.setValueAtTime(0, t);
      } else {
        l.setPosition(pos.x, pos.y, pos.z);
        l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
      }
    },
    // 브레이킹 연습 신호: 짧은 두 번 삑
    cue() {
      tone(1320, 1320, 0.06, 0.25, { type: 'square' });
      tone(1760, 1760, 0.06, 0.25, { type: 'square', delay: 0.08 });
    },
    // 칼 휘두르는 바람 소리
    swing() {
      noise(n('bandpass', 900, 2, 0.35, 0.16), { sweepTo: 3500 });
    },
    // 봇의 총소리: 봇 위치에서 들린다.
    enemyShot(pos) {
      const out = panner(pos);
      const p = SHOT_PROFILES.rifle;
      const rate = 0.95 + Math.random() * 0.1;
      for (const l of p.layers) noise(l, { rate, out });
      const [f0, f1, dur, gain] = p.thump;
      tone(f0 * rate, f1, dur, gain, { out });
    },
    // 내가 맞았을 때: 머리는 날카롭게, 몸은 둔하게
    hurt(part) {
      if (part === 'head') bell(1500, 0.18, 0.25);
      noise(n('lowpass', 420, 0.8, 0.7, 0.12));
      tone(120, 50, 0.12, 0.5);
    },
    death() {
      tone(220, 55, 0.7, 0.5, { type: 'triangle' });
      noise(n('lowpass', 300, 0.7, 0.4, 0.6));
    },
    // 봇 발소리: 바닥을 디디는 둔탁한 소리 + 신발 마찰음. 왼발/오른발을 조금 다르게.
    step(pos) {
      const out = panner(pos);
      stepAlt = !stepAlt;
      const rate = (stepAlt ? 1.0 : 0.9) + Math.random() * 0.08;
      noise(n('lowpass', 520, 0.9, 0.9, 0.07), { rate, out });
      noise(n('bandpass', 2400, 1.4, 0.18, 0.035), { rate, delay: 0.012, out });
      tone(stepAlt ? 85 : 75, 45, 0.06, 0.6, { out });
    },
    shot(kind = 'rifle') {
      const p = SHOT_PROFILES[kind] ?? SHOT_PROFILES.rifle;
      const rate = 0.94 + Math.random() * 0.12;
      for (const l of p.layers) noise(l, { rate });
      const [f0, f1, dur, gain] = p.thump;
      tone(f0 * rate, f1, dur, gain);
    },
    // 헤드샷: 짧고 높은 금속성 '팅'
    head() {
      bell(2300, 0.22, 0.3);
      noise(n('highpass', 7000, 0.7, 0.18, 0.02));
    },
    // 몸샷: 둔탁한 '퍽'
    body() {
      noise(n('lowpass', 750, 0.8, 0.55, 0.06));
      tone(190, 85, 0.07, 0.35);
    },
    // 처치: 가라앉는 저음 + 올라가는 두 음 종소리 + 바람 소리. 연속 처치일수록 음이 높아진다.
    kill(streak = 1) {
      const base = 620 * 2 ** (((Math.min(5, Math.max(1, streak)) - 1) * 2) / 12);
      tone(95, 45, 0.18, 0.5);
      noise(n('bandpass', 500, 1.5, 0.25, 0.28), { sweepTo: 3200 });
      bell(base, 0.5, 0.22, 0.03);
      bell(base * 1.5, 0.65, 0.2, 0.1);
    },
  };
}
