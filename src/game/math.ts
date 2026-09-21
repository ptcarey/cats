import type { Vec } from './types';

export const vec = (x = 0, y = 0): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });

export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l < 1e-6 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest signed angle from `a` to `b`, in radians. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Eases `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  return from + clamp(d, -maxStep, maxStep);
}

/** Frame-rate independent smoothing factor for exponential easing. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/**
 * A small seedable generator. The game seeds it from the clock so play varies,
 * while the headless simulation seeds it explicitly so a match can be replayed
 * exactly and tuning is measured against real changes rather than luck.
 */
let rngState = (Date.now() ^ 0x9e3779b9) >>> 0;

export function seedRandom(seed: number): void {
  rngState = (seed >>> 0) || 1;
}

/** mulberry32: small, fast and good enough for gameplay jitter. */
export function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(lo: number, hi: number): number {
  return lo + random() * (hi - lo);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
