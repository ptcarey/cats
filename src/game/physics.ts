import {
  AUTO_GOAL_DECAY,
  AUTO_GOAL_RADIUS,
  AUTO_GOAL_TIME,
  BALL_FRICTION,
  BALL_MAX_SPEED,
  BALL_RADIUS,
  CAT_BOUNCE,
  CAT_RADIUS,
  COLLECT_RADIUS,
  COLLECT_SPEED,
  DIFFICULTIES,
  DRIBBLE_OFFSET,
  GOAL_X0,
  GOAL_X1,
  PITCH,
  TACKLE_STUN,
  TACKLE_TIME,
  TACKLE_RADIUS,
  WALL_BOUNCE,
} from './constants';
import { clamp, dist, norm } from './math';
import { attackingGoal } from './state';
import { spawnPuff } from './fx';
import type { Cat, MatchState, TeamId, Vec } from './types';

export type GameEvent =
  | { type: 'kick'; power: number }
  | { type: 'collect' }
  | { type: 'tackle' }
  | { type: 'wall' }
  | { type: 'goal'; team: TeamId; reason: 'shot' | 'auto' };

/** Applies a kick to the ball and releases possession. */
export function kickBall(state: MatchState, cat: Cat, dir: Vec, speed: number): void {
  const d = norm(dir);
  state.ball.owner = null;
  state.ball.pos.x = cat.pos.x + d.x * DRIBBLE_OFFSET;
  state.ball.pos.y = cat.pos.y + d.y * DRIBBLE_OFFSET;
  state.ball.vel.x = d.x * speed;
  state.ball.vel.y = d.y * speed;
  cat.kickCooldown = 0.28;
  cat.ponder = 0;
  cat.facing = Math.atan2(d.y, d.x);
}

export function integrate(state: MatchState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  const spec = DIFFICULTIES[state.difficulty];

  moveCats(state, dt);
  separateCats(state);
  updateBall(state, dt, events);
  updateTackles(state, dt, spec.tackle, events);
  collectBall(state, events);
  updateAutoGoal(state, dt, events);

  state.shake = Math.max(0, state.shake - dt * 3.4);
  return events;
}

function moveCats(state: MatchState, dt: number): void {
  for (const cat of state.cats) {
    cat.stun = Math.max(0, cat.stun - dt);
    cat.kickCooldown = Math.max(0, cat.kickCooldown - dt);

    cat.pos.x += cat.vel.x * dt;
    cat.pos.y += cat.vel.y * dt;

    // Cats stay on the pitch; only the ball may cross the goal line.
    const minX = CAT_RADIUS;
    const maxX = PITCH.w - CAT_RADIUS;
    const minY = CAT_RADIUS;
    const maxY = PITCH.h - CAT_RADIUS;
    if (cat.pos.x < minX) {
      cat.pos.x = minX;
      cat.vel.x = Math.abs(cat.vel.x) * 0.3;
    } else if (cat.pos.x > maxX) {
      cat.pos.x = maxX;
      cat.vel.x = -Math.abs(cat.vel.x) * 0.3;
    }
    if (cat.pos.y < minY) {
      cat.pos.y = minY;
      cat.vel.y = Math.abs(cat.vel.y) * 0.3;
    } else if (cat.pos.y > maxY) {
      cat.pos.y = maxY;
      cat.vel.y = -Math.abs(cat.vel.y) * 0.3;
    }

    const speed = Math.hypot(cat.vel.x, cat.vel.y);
    if (speed > 1.2) {
      cat.facing = Math.atan2(cat.vel.y, cat.vel.x);
      cat.animPhase += dt * (5 + speed * 0.42);
    } else {
      cat.animPhase += dt * 1.6;
    }
  }
}

/** Pushes overlapping cats apart so they never stack on top of each other. */
function separateCats(state: MatchState): void {
  const cats = state.cats;
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = cats[i];
      const b = cats[j];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dy);
      const min = CAT_RADIUS * 2;
      if (d >= min || d < 1e-5) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.pos.x -= nx * push;
      a.pos.y -= ny * push;
      b.pos.x += nx * push;
      b.pos.y += ny * push;
      const rel = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
      if (rel < 0) {
        const imp = rel * CAT_BOUNCE;
        a.vel.x += nx * imp;
        a.vel.y += ny * imp;
        b.vel.x -= nx * imp;
        b.vel.y -= ny * imp;
      }
    }
  }
}

function updateBall(state: MatchState, dt: number, events: GameEvent[]): void {
  const ball = state.ball;

  if (ball.owner) {
    const o = ball.owner;
    if (o.stun > 0) {
      ball.owner = null;
    } else {
      // The ball is carried just in front of the nose.
      const tx = o.pos.x + Math.cos(o.facing) * DRIBBLE_OFFSET;
      const ty = o.pos.y + Math.sin(o.facing) * DRIBBLE_OFFSET;
      ball.vel.x = (tx - ball.pos.x) / Math.max(dt, 1e-4);
      ball.vel.y = (ty - ball.pos.y) / Math.max(dt, 1e-4);
      ball.pos.x = tx;
      ball.pos.y = ty;
      ball.roll += Math.hypot(o.vel.x, o.vel.y) * dt * 0.5;
      ball.pos.x = clamp(ball.pos.x, BALL_RADIUS, PITCH.w - BALL_RADIUS);
      return;
    }
  }

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.roll += Math.hypot(ball.vel.x, ball.vel.y) * dt * 0.5;

  const decay = Math.exp(-BALL_FRICTION * dt);
  ball.vel.x *= decay;
  ball.vel.y *= decay;
  if (Math.hypot(ball.vel.x, ball.vel.y) < 0.6) {
    ball.vel.x = 0;
    ball.vel.y = 0;
  }
  const sp = Math.hypot(ball.vel.x, ball.vel.y);
  if (sp > BALL_MAX_SPEED) {
    ball.vel.x = (ball.vel.x / sp) * BALL_MAX_SPEED;
    ball.vel.y = (ball.vel.y / sp) * BALL_MAX_SPEED;
  }

  // Touchlines.
  if (ball.pos.x < BALL_RADIUS) {
    ball.pos.x = BALL_RADIUS;
    ball.vel.x = Math.abs(ball.vel.x) * WALL_BOUNCE;
    events.push({ type: 'wall' });
  } else if (ball.pos.x > PITCH.w - BALL_RADIUS) {
    ball.pos.x = PITCH.w - BALL_RADIUS;
    ball.vel.x = -Math.abs(ball.vel.x) * WALL_BOUNCE;
    events.push({ type: 'wall' });
  }

  const inMouth = ball.pos.x > GOAL_X0 && ball.pos.x < GOAL_X1;

  // Goal lines. Team 0 attacks y = 0, team 1 attacks y = PITCH.h.
  if (ball.pos.y < BALL_RADIUS) {
    if (inMouth) {
      events.push({ type: 'goal', team: 0, reason: 'shot' });
      return;
    }
    ball.pos.y = BALL_RADIUS;
    ball.vel.y = Math.abs(ball.vel.y) * WALL_BOUNCE;
    events.push({ type: 'wall' });
  } else if (ball.pos.y > PITCH.h - BALL_RADIUS) {
    if (inMouth) {
      events.push({ type: 'goal', team: 1, reason: 'shot' });
      return;
    }
    ball.pos.y = PITCH.h - BALL_RADIUS;
    ball.vel.y = -Math.abs(ball.vel.y) * WALL_BOUNCE;
    events.push({ type: 'wall' });
  }

  // A loose ball bounces off cats that cannot collect it.
  for (const cat of state.cats) {
    const d = dist(cat.pos, ball.pos);
    const min = CAT_RADIUS + BALL_RADIUS;
    if (d >= min || d < 1e-5) continue;
    const nx = (ball.pos.x - cat.pos.x) / d;
    const ny = (ball.pos.y - cat.pos.y) / d;
    ball.pos.x = cat.pos.x + nx * min;
    ball.pos.y = cat.pos.y + ny * min;
    const rel = ball.vel.x * nx + ball.vel.y * ny;
    if (rel < 0) {
      ball.vel.x -= 2 * rel * nx * 0.8;
      ball.vel.y -= 2 * rel * ny * 0.8;
    }
    ball.vel.x += cat.vel.x * 0.32;
    ball.vel.y += cat.vel.y * 0.32;
  }
}

function updateTackles(state: MatchState, dt: number, tackleMult: number, events: GameEvent[]): void {
  const owner = state.ball.owner;
  for (const cat of state.cats) {
    if (!owner || cat.team === owner.team || cat.stun > 0) {
      cat.tackle = Math.max(0, cat.tackle - dt * 2);
      continue;
    }
    if (dist(cat.pos, owner.pos) <= TACKLE_RADIUS) {
      // The player tackles at the baseline rate; the computer is slowed by difficulty.
      const mult = cat.team === 0 ? 1 : tackleMult;
      cat.tackle += dt / mult;
      if (cat.tackle >= TACKLE_TIME) {
        cat.tackle = 0;
        owner.stun = TACKLE_STUN;
        owner.ponder = 0;
        state.ball.owner = null;
        state.ball.vel.x = (owner.pos.x - cat.pos.x) * 2.4 + owner.vel.x * 0.4;
        state.ball.vel.y = (owner.pos.y - cat.pos.y) * 2.4 + owner.vel.y * 0.4;
        spawnPuff(state, owner.pos, '#ffffff', 10);
        state.shake = Math.min(1, state.shake + 0.35);
        events.push({ type: 'tackle' });
      }
    } else {
      cat.tackle = Math.max(0, cat.tackle - dt * 2);
    }
  }
}

function collectBall(state: MatchState, events: GameEvent[]): void {
  const ball = state.ball;
  if (ball.owner) return;

  let best: Cat | null = null;
  let bestD = Infinity;
  for (const cat of state.cats) {
    if (cat.stun > 0 || cat.kickCooldown > 0) continue;
    const d = dist(cat.pos, ball.pos);
    if (d > COLLECT_RADIUS) continue;
    // A fast ball cannot be plucked out of the air; it has to slow down first.
    const rel = Math.hypot(ball.vel.x - cat.vel.x, ball.vel.y - cat.vel.y);
    if (rel > COLLECT_SPEED) continue;
    if (d < bestD) {
      bestD = d;
      best = cat;
    }
  }

  if (best) {
    ball.owner = best;
    best.ponder = 0;
    events.push({ type: 'collect' });
  }
}

/**
 * Mercy rule for young players: keep the ball near the goal you are attacking
 * and it eventually counts, even if the child never manages a shot.
 *
 * The charge belongs to the team rather than to one cat, and it bleeds away
 * instead of resetting, so passing between cats or being briefly tackled does
 * not throw away all the pressure built up.
 */
function updateAutoGoal(state: MatchState, dt: number, events: GameEvent[]): void {
  const owner = state.ball.owner;
  const charge = state.autoGoal;

  let pressing: TeamId | null = null;
  if (owner) {
    const goal = attackingGoal(owner.team);
    if (dist(owner.pos, goal) <= AUTO_GOAL_RADIUS) pressing = owner.team;
  }

  if (pressing === null) {
    charge.t = Math.max(0, charge.t - dt * AUTO_GOAL_DECAY);
    if (charge.t === 0) charge.team = null;
    return;
  }

  if (charge.team !== pressing) {
    charge.team = pressing;
    charge.t = 0;
  }

  charge.t += dt;
  if (charge.t >= AUTO_GOAL_TIME) {
    charge.team = null;
    charge.t = 0;
    events.push({ type: 'goal', team: pressing, reason: 'auto' });
  }
}
