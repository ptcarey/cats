import { CAT_RADIUS } from './constants';
import { autoContrast, shade, withAlpha } from './color';
import type { CatSkin } from './types';

export interface ResolvedSkin {
  /** Main coat. */
  coat: string;
  /** Stripes, spots or bib. */
  mark: string;
  /** Inner ears, paws and tail tip. */
  accent: string;
  pattern: CatSkin['pattern'];
}

/**
 * Fills in the slots the player left empty. Picking one colour still yields a
 * cat with visible ears and paws rather than a flat blob.
 */
export function resolveSkin(skin: CatSkin): ResolvedSkin {
  const coat = skin.colors[0] ?? '#f0833a';
  const mark = skin.colors[1] ?? autoContrast(coat);
  const accent = skin.colors[2] ?? mark;
  return { coat, mark, accent, pattern: skin.pattern };
}

/**
 * Cat proportions, in multiples of CAT_RADIUS, for a cat seen from above with
 * its nose along +X. Keeping them in one table makes the silhouette easy to
 * retune without hunting through the drawing code. The head sits clear of the
 * body so the two shapes read separately even at pitch size.
 */
const G = {
  bodyX: -0.22,
  bodyRx: 1.02,
  bodyRy: 0.68,
  headX: 1.02,
  headR: 0.6,
  /** Angle of each ear away from the nose direction, in radians. */
  earAngle: 0.95,
  earSpread: 0.44,
  earLength: 1.62,
  tailBase: -1.1,
  tailTip: -2.25,
  frontPawX: 0.5,
  frontPawY: 0.58,
  backPawX: -0.78,
  backPawY: 0.62,
  pawRx: 0.26,
  pawRy: 0.21,
} as const;

/** Total drawn length in radii, from tail tip to nose, for sizing previews. */
export const CAT_DRAW_LENGTH = G.headX + G.headR - G.tailTip;

interface DrawOpts {
  /** Radians. The cat is drawn nose-first along this direction. */
  facing: number;
  /** Drives paw and tail movement. */
  phase: number;
  /** 0 = standing, 1 = full sprint. Scales the animation. */
  motion: number;
  /** Multiplies CAT_RADIUS, for menu previews. */
  scale?: number;
  /** Ring colour drawn on the ground under the cat, or null for none. */
  ring?: string | null;
  /** Draws a brighter halo, used for the cat the player is aiming with. */
  highlight?: boolean;
  /** Dims the cat while stunned. */
  dim?: boolean;
}

/** Draws a top-down cat centred on the current origin. */
export function drawCat(ctx: CanvasRenderingContext2D, skin: ResolvedSkin, o: DrawOpts): void {
  const r = CAT_RADIUS * (o.scale ?? 1);
  const swing = Math.sin(o.phase) * o.motion;
  const swingB = Math.sin(o.phase + Math.PI) * o.motion;
  const outline = shade(skin.coat, -0.62);
  const lw = r * 0.14;

  ctx.save();

  if (o.ring) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.42, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(o.ring, o.highlight ? 0.5 : 0.28);
    ctx.fill();
    ctx.lineWidth = r * 0.17;
    ctx.strokeStyle = withAlpha(o.ring, o.highlight ? 1 : 0.8);
    ctx.stroke();
  }

  ctx.rotate(o.facing);
  if (o.dim) ctx.globalAlpha = 0.55;

  drawTail(ctx, r, lw, outline, skin, swing);
  drawPaws(ctx, r, lw, outline, skin, swing, swingB);
  drawBody(ctx, r, lw, outline, skin);
  drawHead(ctx, r, lw, outline, skin, swing);

  ctx.restore();
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  r: number,
  lw: number,
  outline: string,
  skin: ResolvedSkin,
  swing: number,
): void {
  // The tail curves to one side so it never reads as a fifth leg.
  const wag = (0.45 + swing * 0.55) * r;
  const tipX = G.tailTip * r;
  const tipY = wag;

  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(G.tailBase * r, 0);
  ctx.quadraticCurveTo(-1.85 * r, wag * 0.3, tipX, tipY);
  ctx.lineWidth = r * 0.32 + lw * 1.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.lineWidth = r * 0.32;
  ctx.strokeStyle = skin.coat;
  ctx.stroke();

  // Tail tip in the accent colour, so a third colour choice is always visible.
  ctx.beginPath();
  ctx.arc(tipX, tipY, r * 0.21, 0, Math.PI * 2);
  ctx.fillStyle = skin.accent;
  ctx.fill();
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

function drawPaws(
  ctx: CanvasRenderingContext2D,
  r: number,
  lw: number,
  outline: string,
  skin: ResolvedSkin,
  swing: number,
  swingB: number,
): void {
  // Tuxedo cats get white socks; everyone else uses the accent colour.
  const pawColor = skin.pattern === 'tuxedo' ? skin.mark : skin.accent;

  const paw = (x: number, y: number, s: number): void => {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.4, y, r * G.pawRx, r * G.pawRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = pawColor;
    ctx.fill();
    ctx.lineWidth = lw * 0.85;
    ctx.strokeStyle = outline;
    ctx.stroke();
  };

  paw(G.frontPawX * r, -G.frontPawY * r, swing);
  paw(G.frontPawX * r, G.frontPawY * r, swingB);
  paw(G.backPawX * r, -G.backPawY * r, swingB);
  paw(G.backPawX * r, G.backPawY * r, swing);
}

function bodyPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.ellipse(G.bodyX * r, 0, G.bodyRx * r, G.bodyRy * r, 0, 0, Math.PI * 2);
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  lw: number,
  outline: string,
  skin: ResolvedSkin,
): void {
  bodyPath(ctx, r);
  ctx.fillStyle = skin.coat;
  ctx.fill();

  // Markings are clipped to the body so they never bleed past the silhouette.
  ctx.save();
  bodyPath(ctx, r);
  ctx.clip();
  ctx.fillStyle = skin.mark;

  if (skin.pattern === 'tabby') {
    for (let i = 0; i < 4; i++) {
      const x = (-0.92 + i * 0.47) * r;
      ctx.beginPath();
      ctx.ellipse(x, 0, r * 0.1, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'patches') {
    const spots: [number, number, number][] = [
      [-0.72, -0.28, 0.3],
      [-0.12, 0.3, 0.26],
      [0.45, -0.24, 0.23],
      [-0.42, 0.02, 0.15],
    ];
    for (const [x, y, s] of spots) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'tuxedo') {
    // A bib across the chest, i.e. the front half of the body.
    ctx.beginPath();
    ctx.ellipse(0.55 * r, 0, 0.6 * r, 0.52 * r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  bodyPath(ctx, r);
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  r: number,
  lw: number,
  outline: string,
  skin: ResolvedSkin,
  swing: number,
): void {
  const hx = G.headX * r;
  const hy = swing * r * 0.05;
  const hr = G.headR * r;

  // Ears first, so the head circle covers their base and they look attached.
  ctx.lineJoin = 'round';
  for (const side of [-1, 1] as const) {
    const a = side * G.earAngle;
    const b1 = a - side * G.earSpread;
    const b2 = a + side * G.earSpread;

    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(b1) * hr * 0.95, hy + Math.sin(b1) * hr * 0.95);
    ctx.lineTo(hx + Math.cos(a) * hr * G.earLength, hy + Math.sin(a) * hr * G.earLength);
    ctx.lineTo(hx + Math.cos(b2) * hr * 0.95, hy + Math.sin(b2) * hr * 0.95);
    ctx.closePath();
    ctx.fillStyle = skin.coat;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = outline;
    ctx.stroke();

    // Inner ear picks up the accent colour.
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(b1) * hr * 0.88, hy + Math.sin(b1) * hr * 0.88);
    ctx.lineTo(hx + Math.cos(a) * hr * (G.earLength - 0.38), hy + Math.sin(a) * hr * (G.earLength - 0.38));
    ctx.lineTo(hx + Math.cos(b2) * hr * 0.88, hy + Math.sin(b2) * hr * 0.88);
    ctx.closePath();
    ctx.fillStyle = skin.accent;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fillStyle = skin.coat;
  ctx.fill();

  if (skin.pattern === 'tabby') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = skin.mark;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(hx - hr * 0.5, hy + i * hr * 0.38, hr * 0.09, hr * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.stroke();

  // Eyes and nose, seen from above at a slight forward angle.
  ctx.fillStyle = '#20242a';
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.3, hy + side * hr * 0.34, hr * 0.15, hr * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx + hr * 0.68, hy, hr * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9db5';
  ctx.fill();
}
