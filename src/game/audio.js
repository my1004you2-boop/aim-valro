// WebAudio로 합성한 효과음. 첫 사용자 입력 이후에 소리가 난다.
export function createAudio(settings) {
  let ctx = null;
  let master = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    master.gain.value = settings.audio.enabled ? settings.audio.volume : 0;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone(freq, dur, type, gain, endFreq = freq) {
    const c = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function noise(dur, gain, cutoff) {
    const c = ensure();
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  return {
    unlock: ensure,
    shot: () => {
      noise(0.09, 0.5, 2600);
      tone(140, 0.08, 'triangle', 0.25, 60);
    },
    head: () => {
      tone(1900, 0.12, 'sine', 0.35, 1500);
      tone(3800, 0.06, 'sine', 0.12);
    },
    body: () => tone(220, 0.09, 'square', 0.12, 120),
    kill: () => tone(880, 0.15, 'sine', 0.2, 1320),
  };
}
