import {
  AUTO_GOAL_TIME,
  BALL_RADIUS,
  CAT_RADIUS,
  CAT_SPEED,
  GOAL_DEPTH,
  GOAL_WIDTH,
  GOAL_X0,
  MARGIN,
  PITCH,
  TEAM_RING,
} from './constants';
import { withAlpha } from './color';
import { drawCat, resolveSkin } from './cat';
import { toScreen, type Camera } from './camera';
import type { Cat, MatchState } from './types';

const GRASS_DARK = '#1f7a43';
const GRASS_LIGHT = '#258c4d';
const SURROUND = '#14351f';
const LINE = 'rgba(255,255,255,0.78)';

export function render(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  ctx.save();

  // A small shake sells tackles and goals without moving the simulation.
  if (state.shake > 0.01) {
    const s = state.shake * 3;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawSurround(ctx, cam);
  drawPitch(ctx, cam);
  drawGoals(ctx, cam, state);
  drawParticles(ctx, cam, state);
  drawShadows(ctx, cam, state);
  drawAim(ctx, cam, state);
  drawCats(ctx, cam, state);
  drawBall(ctx, cam, state);

  ctx.restore();
}

function drawSurround(ctx: CanvasRenderingContext2D, cam: Camera): void {
  ctx.fillStyle = SURROUND;
  ctx.fillRect(0, 0, cam.w, cam.h);
}

function drawPitch(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const o = toScreen(cam, { x: 0, y: 0 });
  const w = PITCH.w * cam.scale;
  const h = PITCH.h * cam.scale;

  ctx.fillStyle = GRASS_DARK;
  ctx.fillRect(o.x, o.y, w, h);

  // Mown stripes give the pitch some depth.
  const bands = 10;
  ctx.fillStyle = GRASS_LIGHT;
  for (let i = 0; i < bands; i += 2) {
    ctx.fillRect(o.x, o.y + (h / bands) * i, w, h / bands);
  }

  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1.2, 0.55 * cam.scale);
  ctx.strokeRect(o.x, o.y, w, h);

  // Halfway line and centre circle.
  ctx.beginPath();
  ctx.moveTo(o.x, o.y + h / 2);
  ctx.lineTo(o.x + w, o.y + h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(o.x + w / 2, o.y + h / 2, 15 * cam.scale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(o.x + w / 2, o.y + h / 2, 1.1 * cam.scale, 0, Math.PI * 2);
  ctx.fillStyle = LINE;
  ctx.fill();

  // Penalty areas at both ends.
  const boxW = 54 * cam.scale;
  const boxH = 24 * cam.scale;
  ctx.strokeRect(o.x + w / 2 - boxW / 2, o.y, boxW, boxH);
  ctx.strokeRect(o.x + w / 2 - boxW / 2, o.y + h - boxH, boxW, boxH);
}

function drawGoals(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  for (const team of [0, 1] as const) {
    // Team 0 attacks the top goal, so the top net belongs to team 1.
    const top = team === 0;
    const gx = toScreen(cam, { x: GOAL_X0, y: 0 }).x;
    const gw = GOAL_WIDTH * cam.scale;
    const depth = GOAL_DEPTH * cam.scale;
    const lineY = toScreen(cam, { x: 0, y: top ? 0 : PITCH.h }).y;
    const y = top ? lineY - depth : lineY;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(gx, y, gw, depth);

    // Net mesh.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    const step = Math.max(5, 3.4 * cam.scale);
    ctx.beginPath();
    for (let x = gx; x <= gx + gw + 0.1; x += step) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + depth);
    }
    for (let yy = y; yy <= y + depth + 0.1; yy += step) {
      ctx.moveTo(gx, yy);
      ctx.lineTo(gx + gw, yy);
    }
    ctx.stroke();

    // Posts and crossbar, tinted with the owning team's colour.
    ctx.strokeStyle = TEAM_RING[team === 0 ? 1 : 0];
    ctx.lineWidth = Math.max(2.5, 1.1 * cam.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx, y + (top ? depth : 0));
    ctx.lineTo(gx, y + (top ? 0 : depth));
    ctx.moveTo(gx + gw, y + (top ? depth : 0));
    ctx.lineTo(gx + gw, y + (top ? 0 : depth));
    ctx.moveTo(gx, top ? y : y + depth);
    ctx.lineTo(gx + gw, top ? y : y + depth);
    ctx.stroke();
    ctx.restore();
  }

  // A soft glow on the goal you are attacking, so kids know which way to shoot.
  if (state.phase === 'play') {
    const gx = toScreen(cam, { x: GOAL_X0, y: 0 }).x;
    const gw = GOAL_WIDTH * cam.scale;
    const lineY = toScreen(cam, { x: 0, y: 0 }).y;
    const pulse = 0.18 + Math.sin(state.elapsed * 3) * 0.08;
    const grad = ctx.createLinearGradient(0, lineY - MARGIN.y * cam.scale, 0, lineY + 14 * cam.scale);
    grad.addColorStop(0, withAlpha(TEAM_RING[0], pulse));
    grad.addColorStop(1, withAlpha(TEAM_RING[0], 0));
    ctx.fillStyle = grad;
    ctx.fillRect(gx - 4, lineY - MARGIN.y * cam.scale, gw + 8, (MARGIN.y + 14) * cam.scale);
  }
}

function drawShadows(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (const cat of state.cats) {
    const p = toScreen(cam, cat.pos);
    ctx.beginPath();
    ctx.ellipse(p.x + cam.scale * 0.6, p.y + cam.scale * 1.1, CAT_RADIUS * 1.15 * cam.scale, CAT_RADIUS * 0.95 * cam.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const b = toScreen(cam, state.ball.pos);
  ctx.beginPath();
  ctx.ellipse(b.x + cam.scale * 0.5, b.y + cam.scale * 0.9, BALL_RADIUS * cam.scale, BALL_RADIUS * 0.8 * cam.scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCats(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  // Draw the ball carrier last so it sits on top of the scrum.
  const order = [...state.cats].sort((a, b) => {
    const ao = state.ball.owner === a ? 1 : 0;
    const bo = state.ball.owner === b ? 1 : 0;
    return ao - bo || a.pos.y - b.pos.y;
  });

  for (const cat of order) {
    const p = toScreen(cam, cat.pos);
    const speed = Math.hypot(cat.vel.x, cat.vel.y);
    const isCarrier = state.ball.owner === cat;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(cam.scale, cam.scale);
    drawCat(ctx, resolveSkin(cat.skin), {
      facing: cat.facing,
      phase: cat.animPhase,
      motion: Math.min(1, speed / CAT_SPEED),
      ring: TEAM_RING[cat.team],
      highlight: isCarrier,
      dim: cat.stun > 0,
    });
    ctx.restore();

    if (isCarrier && cat.team === 0 && state.phase === 'play') {
      drawCarrierPulse(ctx, p, cam, state.elapsed);
    }
    if (isCarrier && state.autoGoal.team === cat.team && state.autoGoal.t > 0.15) {
      drawAutoGoalCharge(ctx, p, cam, state.autoGoal.t / AUTO_GOAL_TIME, cat.team);
    }
  }
}

function drawCarrierPulse(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, cam: Camera, t: number): void {
  const phase = (t * 1.4) % 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, (CAT_RADIUS * 1.4 + phase * 5) * cam.scale, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(TEAM_RING[0], (1 - phase) * 0.7);
  ctx.lineWidth = Math.max(1.5, 0.5 * cam.scale);
  ctx.stroke();
}

/**
 * Fills a ring around the carrier as the mercy-rule timer runs, so a child can
 * see the goal coming rather than having it happen out of nowhere.
 */
function drawAutoGoalCharge(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  cam: Camera,
  progress: number,
  team: number,
): void {
  const t = Math.min(1, progress);
  const radius = CAT_RADIUS * 1.75 * cam.scale;

  ctx.save();
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(3, 0.7 * cam.scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
  ctx.strokeStyle = TEAM_RING[team];
  ctx.lineWidth = Math.max(3, 0.7 * cam.scale);
  ctx.stroke();

  // A last flourish as it completes.
  if (t > 0.75) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + (t - 0.75) * 22 * cam.scale * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha('#ffffff', (1 - t) * 3);
    ctx.lineWidth = Math.max(1.5, 0.35 * cam.scale);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  const p = toScreen(cam, state.ball.pos);
  const r = BALL_RADIUS * cam.scale;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(state.ball.roll * 0.15);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#fdfdfd';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = '#2b2f36';
  ctx.stroke();

  // A simple pentagon motif reads as a soccer ball at this size.
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r * 0.42;
    const y = Math.sin(a) * r * 0.42;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
  ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  const aim = state.aim;
  const owner = state.ball.owner;
  if (!aim.active || !owner || owner.team !== 0 || !aim.target) return;

  const from = toScreen(cam, state.ball.pos);
  const to = toScreen(cam, aim.target.pos);
  const strength = aim.power;

  ctx.save();
  ctx.lineCap = 'round';

  // Dashed guide from the ball to the chosen target.
  ctx.setLineDash([8, 7]);
  ctx.lineDashOffset = -state.elapsed * 34;
  ctx.strokeStyle = withAlpha(TEAM_RING[0], 0.55 + strength * 0.35);
  ctx.lineWidth = Math.max(2.5, (0.6 + strength * 0.9) * cam.scale);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead.
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const head = Math.max(9, 2.4 * cam.scale);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(ang - 0.42) * head, to.y - Math.sin(ang - 0.42) * head);
  ctx.lineTo(to.x - Math.cos(ang + 0.42) * head, to.y - Math.sin(ang + 0.42) * head);
  ctx.closePath();
  ctx.fillStyle = TEAM_RING[0];
  ctx.fill();

  // Ring the locked-on target so the child can see what will receive the ball.
  if (aim.target.kind !== 'free') {
    const pulse = 1 + Math.sin(state.elapsed * 9) * 0.06;
    const radius = (aim.target.kind === 'teammate' ? CAT_RADIUS * 1.85 : GOAL_WIDTH * 0.32) * cam.scale * pulse;
    ctx.beginPath();
    ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, 0.5 * cam.scale);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, cam: Camera, state: MatchState): void {
  for (const p of state.particles) {
    const s = toScreen(cam, p.pos);
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size * cam.scale * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Exposed so the team builder can reuse the exact match rendering for previews. */
export function drawPreviewCat(
  ctx: CanvasRenderingContext2D,
  cat: Pick<Cat, 'skin'>,
  x: number,
  y: number,
  pxPerUnit: number,
  t: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pxPerUnit, pxPerUnit);
  drawCat(ctx, resolveSkin(cat.skin), {
    facing: -Math.PI / 2,
    phase: t * 4,
    motion: 0.55,
    ring: null,
  });
  ctx.restore();
}
