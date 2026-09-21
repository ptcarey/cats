/**
 * All sound is synthesised with WebAudio. Nothing is downloaded, which keeps
 * the install tiny and avoids shipping licensed audio.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const STORAGE_KEY = 'cats:muted:v1';

try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch {
  muted = false;
}

/** Must be called from inside a user gesture, or iOS will keep the context suspended. */
export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Private browsing: the preference simply will not persist.
  }
  return muted;
}

interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain?: number;
  delay?: number;
  /** Adds a wobble, which is what makes a tone read as a meow. */
  vibrato?: number;
}

function tone(o: ToneOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, t0);
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t0 + o.dur);

  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, o.dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);

  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 11;
    lfoGain.gain.value = o.vibrato;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + o.dur + 0.02);
  }
}

function noise(dur: number, gain: number, freq: number): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

/** A rising-then-falling wobble. Not a real cat, but children read it as one. */
export function sfxMeow(pitch = 1): void {
  tone({ type: 'sawtooth', from: 420 * pitch, to: 700 * pitch, dur: 0.16, gain: 0.16, vibrato: 26 });
  tone({ type: 'sawtooth', from: 700 * pitch, to: 330 * pitch, dur: 0.3, gain: 0.14, delay: 0.15, vibrato: 30 });
}

export function sfxKick(power: number): void {
  const p = Math.max(0.2, Math.min(1, power));
  noise(0.07, 0.16 * p, 900 + p * 700);
  tone({ type: 'triangle', from: 180 + p * 120, to: 70, dur: 0.11, gain: 0.26 * p });
}

export function sfxCollect(): void {
  tone({ type: 'sine', from: 620, to: 880, dur: 0.07, gain: 0.1 });
}

export function sfxTackle(): void {
  noise(0.14, 0.2, 480);
  sfxMeow(1.35);
}

export function sfxWall(): void {
  tone({ type: 'square', from: 260, to: 170, dur: 0.05, gain: 0.07 });
}

export function sfxWhistle(): void {
  tone({ type: 'square', from: 1750, to: 1900, dur: 0.18, gain: 0.09 });
  tone({ type: 'square', from: 1900, to: 1700, dur: 0.2, gain: 0.09, delay: 0.18 });
}

export function sfxGoal(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, gain: 0.2, delay: i * 0.09 }));
  sfxMeow(1.1);
  window.setTimeout(() => sfxMeow(0.85), 280);
}

export function sfxWin(): void {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, gain: 0.2, delay: i * 0.12 }));
  window.setTimeout(() => sfxMeow(1.2), 400);
  window.setTimeout(() => sfxMeow(0.9), 700);
}

export function sfxLose(): void {
  const notes = [494, 440, 392, 330];
  notes.forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, gain: 0.16, delay: i * 0.14 }));
  window.setTimeout(() => sfxMeow(0.7), 500);
}

export function sfxTap(): void {
  tone({ type: 'sine', from: 760, to: 940, dur: 0.05, gain: 0.09 });
}
