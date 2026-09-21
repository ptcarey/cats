import { CAT_RADIUS } from '../game/constants';
import { drawCat, resolveSkin } from '../game/cat';
import { fitCanvas } from './dom';
import type { CatProfile } from '../game/types';

interface Entry {
  canvas: HTMLCanvasElement;
  cats: () => CatProfile[];
  /** Drawn cat height as a fraction of the canvas height. */
  fill: number;
}

const entries = new Set<Entry>();
let raf = 0;
let t = 0;
let last = 0;

function tick(now: number): void {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  t += dt;

  for (const entry of entries) {
    if (!entry.canvas.isConnected) {
      entries.delete(entry);
      continue;
    }
    draw(entry);
  }

  if (entries.size === 0) {
    raf = 0;
    last = 0;
    return;
  }
  raf = requestAnimationFrame(tick);
}

function draw(entry: Entry): void {
  const ctx = fitCanvas(entry.canvas);
  if (!ctx) return;
  const w = entry.canvas.clientWidth || 1;
  const h = entry.canvas.clientHeight || 1;
  const cats = entry.cats();
  if (cats.length === 0) return;

  // Cats face up the screen, so the drawn footprint is about 2.4 radii tall.
  const pxPerUnit = Math.min((h * entry.fill) / (CAT_RADIUS * 2.6), w / (cats.length * CAT_RADIUS * 2.9));
  const gap = w / cats.length;

  cats.forEach((cat, i) => {
    ctx.save();
    ctx.translate(gap * (i + 0.5), h * 0.54);
    ctx.scale(pxPerUnit, pxPerUnit);
    drawCat(ctx, resolveSkin(cat.skin), {
      // Nose up the screen.
      facing: -Math.PI / 2,
      // Stagger the gait so a row of cats does not march in lockstep.
      phase: t * 4.2 + i * 1.7,
      motion: 0.5,
      ring: null,
    });
    ctx.restore();
  });
}

/**
 * Registers a canvas that continuously redraws the cats returned by `cats`.
 * Rendering stops automatically once the canvas leaves the document.
 */
export function attachPreview(canvas: HTMLCanvasElement, cats: () => CatProfile[], fill = 0.82): void {
  const entry: Entry = { canvas, cats, fill };
  entries.add(entry);
  draw(entry);
  if (!raf) raf = requestAnimationFrame(tick);
}
