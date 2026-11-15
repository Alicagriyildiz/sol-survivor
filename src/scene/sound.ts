// Tiny sounds made in the browser (Web Audio), no sound files. Quiet by default and can be
// switched off (remembered). Only the first-person view uses them.

const KEY = 'sol-survivor.sound';
let ctx: AudioContext | null = null;
let on = (() => {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
const VOLUME = 0.12;

export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  try {
    window.localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    // not saved
  }
}

function ac(): AudioContext | null {
  if (!on) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 1) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(VOLUME * gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, freq: number, gain = 1) {
  const c = ac();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(VOLUME * 0.6 * gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

/** Job finished: a small rising chime. */
export const chime = () => {
  tone(660, 0, 0.25, 'triangle');
  tone(880, 0.09, 0.3, 'triangle');
  tone(1320, 0.18, 0.4, 'sine', 0.7);
};
/** A switch / lever / button. */
export const click = () => tone(220, 0, 0.06, 'square', 0.5);
/** Brush stroke / dust. */
export const swish = () => noise(0.12, 2400, 0.8);
/** Walking step (soft). */
export const step = () => noise(0.06, 400, 0.6);
