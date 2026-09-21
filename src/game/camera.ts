import { MARGIN, PITCH } from './constants';
import type { Vec } from './types';

export interface Camera {
  /** Pixels per pitch unit. */
  scale: number;
  /** Screen pixel position of pitch origin (0, 0). */
  ox: number;
  oy: number;
  /** CSS pixel size of the canvas. */
  w: number;
  h: number;
}

const WORLD_W = PITCH.w + MARGIN.x * 2;
const WORLD_H = PITCH.h + MARGIN.y * 2;

/** Fits the whole pitch plus its goal margins into the canvas, letterboxing as needed. */
export function fitCamera(cssW: number, cssH: number): Camera {
  const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  const ox = (cssW - PITCH.w * scale) / 2;
  const oy = (cssH - PITCH.h * scale) / 2;
  return { scale, ox, oy, w: cssW, h: cssH };
}

export function toScreen(cam: Camera, p: Vec): Vec {
  return { x: cam.ox + p.x * cam.scale, y: cam.oy + p.y * cam.scale };
}

export function toPitch(cam: Camera, sx: number, sy: number): Vec {
  return { x: (sx - cam.ox) / cam.scale, y: (sy - cam.oy) / cam.scale };
}
