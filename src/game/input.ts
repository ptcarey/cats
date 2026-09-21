import {
  AIM_TIME_SCALE,
  DIFFICULTIES,
  MAX_DRAG_FRACTION,
  MAX_KICK,
  MIN_KICK,
  PASS_POWER_MAX,
  PASS_POWER_MIN,
  SNAP_ANGLE,
} from './constants';
import { angleDelta, clamp, dist, randRange } from './math';
import { kickSpeedForDistance } from './physics';
import { toPitch, type Camera } from './camera';
import { attackingGoal, openGoalTarget } from './state';
import type { AimTarget, Cat, MatchState, Vec } from './types';

export interface KickRequest {
  cat: Cat;
  dir: Vec;
  speed: number;
  /** 0 to 1, used only for the sound. */
  power: number;
}

/**
 * The player's only control. Touch anywhere while one of your cats has the
 * ball, drag to aim, release to kick. Aiming drops the simulation into slow
 * motion so a young player has time to look.
 */
export class AimController {
  private pointerId: number | null = null;
  private startedWith: Cat | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getState: () => MatchState | null,
    private readonly getCam: () => Camera,
    private readonly onKick: (req: KickRequest) => void,
  ) {
    canvas.addEventListener('pointerdown', this.down, { passive: false });
    canvas.addEventListener('pointermove', this.move, { passive: false });
    canvas.addEventListener('pointerup', this.up, { passive: false });
    canvas.addEventListener('pointercancel', this.cancel, { passive: false });
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.cancel);
  }

  /** True when the player currently has a cat on the ball and could aim. */
  static canAim(state: MatchState | null): boolean {
    return !!state && state.phase === 'play' && !!state.ball.owner && state.ball.owner.team === 0;
  }

  private local(e: PointerEvent): Vec {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private down = (e: PointerEvent): void => {
    const state = this.getState();
    if (!AimController.canAim(state) || this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.startedWith = state!.ball.owner;
    state!.aim.active = true;
    state!.timeScale = AIM_TIME_SCALE;
    this.update(e);
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.update(e);
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const state = this.getState();
    this.update(e);

    if (state && state.aim.active && state.aim.target && state.ball.owner === this.startedWith && this.startedWith) {
      const target = state.aim.target;
      const from = state.ball.pos;
      const dx = target.pos.x - from.x;
      const dy = target.pos.y - from.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-3) {
        let angle = Math.atan2(dy, dx);
        let speed = speedFor(target, d, state.aim.power);
        if (target.kind === 'teammate') {
          // A pass is not a guarantee. A little angular error and a random
          // over- or under-hit mean some run loose or reach an opponent,
          // which keeps possession something to be won rather than owned.
          const slop = DIFFICULTIES[state.difficulty].passSpread;
          angle += randRange(-slop, slop);
          speed *= randRange(PASS_POWER_MIN, PASS_POWER_MAX);
        }
        this.onKick({
          cat: this.startedWith,
          dir: { x: Math.cos(angle), y: Math.sin(angle) },
          speed,
          power: state.aim.power,
        });
      }
    }

    this.release(state);
  };

  private cancel = (): void => {
    this.release(this.getState());
  };

  private release(state: MatchState | null): void {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) {
      this.canvas.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
    this.startedWith = null;
    if (state) {
      state.aim.active = false;
      state.aim.target = null;
      state.aim.power = 0;
      state.timeScale = 1;
    }
  }

  private update(e: PointerEvent): void {
    const state = this.getState();
    const cam = this.getCam();
    if (!state || !state.ball.owner) return;

    const local = this.local(e);
    const point = toPitch(cam, local.x, local.y);
    state.aim.point = point;

    const ballScreen = {
      x: cam.ox + state.ball.pos.x * cam.scale,
      y: cam.oy + state.ball.pos.y * cam.scale,
    };
    const dragPx = Math.hypot(local.x - ballScreen.x, local.y - ballScreen.y);
    const maxDrag = Math.min(cam.w, cam.h) * MAX_DRAG_FRACTION;

    // Too short a drag means the player has not committed to a direction yet.
    if (dragPx < maxDrag * 0.16) {
      state.aim.target = null;
      state.aim.power = 0;
      return;
    }

    state.aim.power = clamp(dragPx / maxDrag, 0.18, 1);
    state.aim.target = snapTarget(state, point);
  }
}

/**
 * Nudges the aim onto a teammate or the goal when the drag points roughly at
 * them. Without this, a five year old almost never completes a pass.
 */
function snapTarget(state: MatchState, point: Vec): AimTarget {
  const owner = state.ball.owner!;
  const from = state.ball.pos;
  const aimAngle = Math.atan2(point.y - from.y, point.x - from.x);

  interface Candidate {
    target: AimTarget;
    delta: number;
  }
  const candidates: Candidate[] = [];

  for (const mate of state.cats) {
    if (mate.team !== 0 || mate === owner) continue;
    const a = Math.atan2(mate.pos.y - from.y, mate.pos.x - from.x);
    const delta = Math.abs(angleDelta(aimAngle, a));
    if (delta < SNAP_ANGLE) {
      candidates.push({ target: { kind: 'teammate', pos: { ...mate.pos }, cat: mate }, delta });
    }
  }

  // Snapping to goal picks the side the keeper has left open, matching what
  // the computer does. Aiming at the centre would just hit the keeper.
  const goalCentre = attackingGoal(0);
  const open = openGoalTarget(state, 0);
  const ga = Math.atan2(goalCentre.y - from.y, goalCentre.x - from.x);
  const gDelta = Math.abs(angleDelta(aimAngle, ga));
  // The goal gets a slightly wider cone, and only counts from the attacking half.
  if (gDelta < SNAP_ANGLE * 1.35 && from.y < 110) {
    candidates.push({ target: { kind: 'goal', pos: { x: open.x, y: open.y - 2 } }, delta: gDelta });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.delta - b.delta);
    return candidates[0].target;
  }

  // Free aim: project the finger direction out to a sensible distance.
  const reach = clamp(dist(from, point), 12, 90);
  return {
    kind: 'free',
    pos: { x: from.x + Math.cos(aimAngle) * reach, y: from.y + Math.sin(aimAngle) * reach },
  };
}

/** Passes are weighted to arrive at a teammate; shots and free kicks use the drag. */
function speedFor(target: AimTarget, distance: number, power: number): number {
  if (target.kind === 'teammate') {
    // Roll a few units past the receiver rather than stopping dead on them.
    return kickSpeedForDistance(distance + 6);
  }
  if (target.kind === 'goal') {
    return MAX_KICK;
  }
  return MIN_KICK + (MAX_KICK - MIN_KICK) * power;
}
