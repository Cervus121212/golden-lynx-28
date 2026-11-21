// WebAudio synth: 3 radio stations (kick + bass every 500 ms), siren, engine, shots.
// Everything is guarded — headless/autopilot must never throw.
import { CFG } from './settings.js';

export function makeSound() {
  const sound = {
    station: 0,
    enabled: false,
    muted: false,
    sirenVolume: 0,
    engineLevel: 0,
    ctx: null,
    _radioTimer: 0,
    _beat: 0,
    _sirenOsc: null,
    _sirenGain: null,
    _engineOsc: null,
    _engineGain: null,
  };

  function ensureCtx() {
    if (sound.ctx) return sound.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      sound.ctx = new AC();
    } catch {
      sound.ctx = null;
    }
    return sound.ctx;
  }

  function tone(freq, dur, type, vol, when = 0) {
    const ctx = sound.ctx;
    if (!ctx || sound.muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  }

  function noiseBurst(dur, vol, freq = 1200) {
    const ctx = sound.ctx;
    if (!ctx || sound.muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  sound.unlock = () => {
    const ctx = ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    sound.enabled = !!ctx;
    if (sound.enabled) sound.startSiren();
  };

  sound.startSiren = () => {
    const ctx = ensureCtx();
    if (!ctx || sound._sirenOsc) return;
    try {
      sound._sirenOsc = ctx.createOscillator();
      sound._sirenOsc.type = 'sine';
      sound._sirenOsc.frequency.value = 880;
      sound._sirenGain = ctx.createGain();
      sound._sirenGain.gain.value = 0;
      sound._sirenOsc.connect(sound._sirenGain);
      sound._sirenGain.connect(ctx.destination);
      sound._sirenOsc.start();
      sound._engineOsc = ctx.createOscillator();
      sound._engineOsc.type = 'sawtooth';
      sound._engineOsc.frequency.value = 60;
      sound._engineGain = ctx.createGain();
      sound._engineGain.gain.value = 0;
      sound._engineOsc.connect(sound._engineGain);
      sound._engineGain.connect(ctx.destination);
      sound._engineOsc.start();
    } catch { /* ignore */ }
  };

  // Radio: one kick + one bass note per beat; beat interval from station bpm.
  sound.update = (dt, speed) => {
    if (!sound.enabled || sound.muted) return;
    const st = CFG.radio[sound.station];
    const beatLen = 60 / st.bpm / 2; // eighth notes
    sound._radioTimer += dt;
    while (sound._radioTimer >= beatLen) {
      sound._radioTimer -= beatLen;
      sound._beat++;
      const b = sound._beat;
      // Kick on the beat, bass walks a minor line.
      if (b % 2 === 0) tone(52, 0.16, 'sine', 0.5);
      const line = [0, 0, 7, 0, 10, 0, 7, 5];
      const semis = line[b % 8];
      const f = st.base * Math.pow(2, semis / 12);
      tone(f, 0.22, 'triangle', 0.22);
      if (b % 8 === 4) tone(f * 2, 0.3, 'sine', 0.1);
    }
    // Siren wail + engine hum follow live values.
    if (sound._sirenOsc && sound._sirenGain) {
      try {
        const t = performance.now() / 1000;
        sound._sirenOsc.frequency.value = 700 + 260 * Math.sin(t * 2.4);
        sound._sirenGain.gain.value = sound.sirenVolume * 0.06;
      } catch { /* ignore */ }
    }
    if (sound._engineOsc && sound._engineGain) {
      try {
        sound._engineOsc.frequency.value = 50 + Math.abs(speed) * 2.2;
        sound._engineGain.gain.value = Math.min(0.05, Math.abs(speed) * 0.0012);
      } catch { /* ignore */ }
    }
  };

  sound.shot = (weaponIndex) => {
    noiseBurst(0.09, weaponIndex === 1 ? 0.25 : 0.4, weaponIndex === 1 ? 2400 : 1500);
  };
  sound.hit = () => tone(220, 0.08, 'square', 0.15);
  sound.pickup = () => {
    tone(660, 0.09, 'sine', 0.2);
    tone(990, 0.14, 'sine', 0.2, 0.09);
  };
  sound.fail = () => tone(140, 0.4, 'sawtooth', 0.2);
  sound.cash = () => {
    tone(880, 0.08, 'sine', 0.18);
    tone(1174, 0.08, 'sine', 0.18, 0.08);
    tone(1568, 0.16, 'sine', 0.18, 0.16);
  };
  sound.nextStation = () => {
    sound.station = (sound.station + 1) % CFG.radio.length;
    sound._beat = 0;
    sound.pickup();
  };
  sound.toggleMute = () => {
    sound.muted = !sound.muted;
    return sound.muted;
  };
  sound.currentStation = () => CFG.radio[sound.station];

  return sound;
}
