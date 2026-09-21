import {
  CAT_ACCEL,
  CAT_RADIUS,
  CAT_SPEED,
  DIFFICULTIES,
  GOAL_X0,
  GOAL_X1,
  HOLD_RANGE,
  MAX_KICK,
  MIN_KICK,
  PITCH,
  SEPARATION_FORCE,
  SEPARATION_RADIUS,
} from './constants';
import { clamp, dist, lerp, norm, randRange } from './math';
import { kickBall } from './physics';
import { attackingGoal, defendingGoal, openGoalTarget } from './state';
import type { Cat, MatchState, TeamId, Vec } from './types';

/** A keeper stuck on the ball clears it upfield rather than stalling the game. */
const KEEPER_CLEAR_TIME = 2.2;

/** Ball this close to our own goal pulls the supporting cat back to help. */
const PRESS_DISTANCE = 48;

/**
 * Both teams move under AI. The player never drives a cat directly; they only
 * choose where the ball goes, so their three cats have to position themselves
 * sensibly on their own.
 */
export function steer(state: MatchState, dt: number): void {
  assignRoles(state, 0);
  assignRoles(state, 1);

  for (const cat of state.cats) {
    const speedMult = cat.team === 0 ? 1 : DIFFICULTIES[state.difficulty].speed;
    driveToward(state, cat, targetFor(state, cat), dt, speedMult);
  }

  decideOpponentKick(state, dt);
  clearKeeperBall(state, dt);
}

/**
 * The keeper is fixed. Of the two outfield cats, the nearer one chases and the
 * other holds a supporting position, which is what stops all three converging
 * on the ball.
 */
function assignRoles(state: MatchState, team: TeamId): void {
  const outfield = state.cats.filter((c) => c.team === team && !c.isKeeper);
  const keeper = state.cats.find((c) => c.team === team && c.isKeeper);
  if (keeper) keeper.role = 'defend';
  if (outfield.length === 0) return;

  const owner = state.ball.owner;
  let chaser: Cat;
  if (owner && owner.team === team && !owner.isKeeper) {
    chaser = owner;
  } else {
    chaser = outfield.reduce((best, c) =>
      dist(c.pos, state.ball.pos) < dist(best.pos, state.ball.pos) ? c : best,
    );
  }

  for (const cat of outfield) cat.role = cat === chaser ? 'chase' : 'support';
}

function targetFor(state: MatchState, cat: Cat): Vec {
  const ball = state.ball;
  const owner = ball.owner;
  const weOwn = owner !== null && owner.team === cat.team;
  const goal = attackingGoal(cat.team);
  const own = defendingGoal(cat.team);
  // -1 when this team attacks upward (team 0), +1 when it attacks downward.
  const fwd = cat.team === 0 ? -1 : 1;

  if (cat.isKeeper) return keeperSpot(state, cat, own);

  if (cat.role === 'chase') {
    if (owner === cat) {
      // Carrying: head for goal, but drift around the closest opponent.
      const threat = nearestOpponent(state, cat);
      if (threat && dist(threat.pos, cat.pos) < CAT_RADIUS * 5) {
        const away = threat.pos.x > cat.pos.x ? -1 : 1;
        return {
          x: clamp(cat.pos.x + away * 24, 10, PITCH.w - 10),
          y: cat.pos.y + fwd * 16,
        };
      }
      // Hold up in front of the net rather than dribbling the ball over the
      // line. Scoring has to come from a kick, or from the mercy timer.
      return { x: goal.x, y: goal.y - fwd * HOLD_RANGE };
    }
    // Chasing: aim slightly ahead of where the ball is going.
    const lead = clamp(dist(cat.pos, ball.pos) / Math.max(CAT_SPEED, 1), 0, 0.42);
    return { x: ball.pos.x + ball.vel.x * lead, y: ball.pos.y + ball.vel.y * lead };
  }

  // Support: stay wide and on the opposite flank to the ball, so the two
  // outfield cats cover the pitch instead of chasing the same spot.
  const side = ball.pos.x < PITCH.w / 2 ? 1 : -1;
  const wide = clamp(PITCH.w / 2 + side * 30, 14, PITCH.w - 14);

  if (weOwn) {
    // Push ahead of the ball to offer a forward pass.
    return { x: wide, y: clamp(ball.pos.y + fwd * 36, 14, PITCH.h - 14) };
  }

  // Under pressure in our own third, the second cat stops holding its wide
  // position and comes back to help. Without this, an attacker can camp in
  // front of goal against a single defender and never be dispossessed.
  if (dist(ball.pos, own) < PRESS_DISTANCE) {
    return {
      x: clamp(ball.pos.x + side * 13, 10, PITCH.w - 10),
      y: clamp(ball.pos.y - fwd * 9, 8, PITCH.h - 8),
    };
  }

  // Otherwise sit goal-side of the ball and wide, ready to intercept.
  return { x: wide, y: clamp(ball.pos.y - fwd * 20, 14, PITCH.h - 14) };
}

/**
 * Holds the goal line, shuffling across to follow the ball.
 *
 * KEEPER_TRACKING is how much of the ball's sideways position the keeper
 * matches. It is deliberately well under 1: a keeper that mirrors the ball
 * perfectly saves almost everything, which turns an even match into a
 * goalless slog rather than the end-to-end game a child wants.
 */
const KEEPER_TRACKING = 0.6;

function keeperSpot(state: MatchState, cat: Cat, own: Vec): Vec {
  const ball = state.ball;
  const away = dist(ball.pos, own);
  // Come off the line a little when the ball is far, tighten up when it is close.
  const out = clamp(away * 0.14, 7, 19);
  return {
    x: clamp(lerp(own.x, ball.pos.x, KEEPER_TRACKING), GOAL_X0 + 3, GOAL_X1 - 3),
    y: own.y + (cat.team === 0 ? -out : out),
  };
}

function nearestOpponent(state: MatchState, cat: Cat): Cat | null {
  let best: Cat | null = null;
  let bestD = Infinity;
  for (const other of state.cats) {
    if (other.team === cat.team) continue;
    const d = dist(other.pos, cat.pos);
    if (d < bestD) {
      bestD = d;
      best = other;
    }
  }
  return best;
}

function driveToward(state: MatchState, cat: Cat, target: Vec, dt: number, speedMult: number): void {
  if (cat.stun > 0) {
    // Stunned cats coast to a stop rather than stopping dead.
    cat.vel.x *= Math.exp(-4 * dt);
    cat.vel.y *= Math.exp(-4 * dt);
    return;
  }

  const to = { x: target.x - cat.pos.x, y: target.y - cat.pos.y };
  const d = Math.hypot(to.x, to.y);
  const dir = norm(to);

  // Ease off near the target so cats settle instead of jittering.
  const arrive = clamp(d / (CAT_RADIUS * 2.4), 0, 1);
  let dx = dir.x * CAT_SPEED * speedMult * arrive;
  let dy = dir.y * CAT_SPEED * speedMult * arrive;

  // Teammates actively push apart, which keeps the three cats spread over the
  // pitch instead of forming a scrum around the ball.
  for (const mate of state.cats) {
    if (mate === cat || mate.team !== cat.team) continue;
    const sep = dist(mate.pos, cat.pos);
    if (sep < SEPARATION_RADIUS && sep > 1e-4) {
      const push = (SEPARATION_RADIUS - sep) / SEPARATION_RADIUS;
      dx += ((cat.pos.x - mate.pos.x) / sep) * CAT_SPEED * push * SEPARATION_FORCE;
      dy += ((cat.pos.y - mate.pos.y) / sep) * CAT_SPEED * push * SEPARATION_FORCE;
    }
  }

  const desired = Math.hypot(dx, dy);
  const cap = CAT_SPEED * speedMult;
  if (desired > cap) {
    dx = (dx / desired) * cap;
    dy = (dy / desired) * cap;
  }

  const ax = dx - cat.vel.x;
  const ay = dy - cat.vel.y;
  const am = Math.hypot(ax, ay);
  const maxStep = CAT_ACCEL * dt;
  if (am > maxStep && am > 1e-5) {
    cat.vel.x += (ax / am) * maxStep;
    cat.vel.y += (ay / am) * maxStep;
  } else {
    cat.vel.x = dx;
    cat.vel.y = dy;
  }
}

/**
 * The computer side's decision each frame. It carries the ball by default and
 * only releases it for a reason: a shot when it is close enough for the ball
 * to actually reach the net, or a pass when it is being closed down. An
 * earlier version kicked on a fixed timer, which made it hot-potato the ball
 * around midfield and never mount an attack.
 */
function decideOpponentKick(state: MatchState, dt: number): void {
  const owner = state.ball.owner;
  if (!owner || owner.team !== 1 || owner.isKeeper || state.phase !== 'play') return;

  const spec = DIFFICULTIES[state.difficulty];
  owner.ponder += dt;

  const goal = attackingGoal(owner.team);
  const toGoal = dist(owner.pos, goal);
  const threat = nearestOpponent(state, owner);
  const pressure = threat ? dist(threat.pos, owner.pos) : Infinity;

  // In range: take a beat to line it up, then shoot at the open corner.
  if (toGoal <= spec.shootRange) {
    if (owner.ponder < spec.ponder) return;
    owner.ponder = 0;
    fireAt(state, owner, openGoalTarget(state, owner.team), MAX_KICK, spec.spread);
    return;
  }

  // Being closed down: lay it off to whichever teammate is best placed.
  if (pressure < CAT_RADIUS * 3.4 && owner.ponder >= spec.ponder * 0.6) {
    const mate = bestPass(state, owner);
    if (mate) {
      owner.ponder = 0;
      const power = clamp(dist(mate.pos, owner.pos) * 1.7 + 12, MIN_KICK, MAX_KICK * 0.9);
      fireAt(state, owner, mate.pos, power, spec.spread);
      return;
    }
  }

  // Nothing on, so keep carrying it forward.
}

/** Kicks toward a point, with difficulty-scaled inaccuracy. */
function fireAt(state: MatchState, cat: Cat, aim: Vec, power: number, spread: number): void {
  const angle =
    Math.atan2(aim.y - cat.pos.y, aim.x - cat.pos.x) + randRange(-spread, spread);
  kickBall(state, cat, { x: Math.cos(angle), y: Math.sin(angle) }, power);
}

/** The teammate furthest forward that is still within passing distance. */
function bestPass(state: MatchState, owner: Cat): Cat | null {
  const fwd = owner.team === 0 ? -1 : 1;
  let best: Cat | null = null;
  let bestScore = -Infinity;

  for (const mate of state.cats) {
    if (mate.team !== owner.team || mate === owner || mate.isKeeper) continue;
    const gap = dist(mate.pos, owner.pos);
    // A pass only carries so far, and a very short one achieves nothing.
    if (gap > 58 || gap < 14) continue;

    const forward = (mate.pos.y - owner.pos.y) * fwd;
    const marker = nearestOpponent(state, mate);
    const space = marker ? dist(marker.pos, mate.pos) : 60;
    const score = forward * 1.3 + space * 0.9;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

/**
 * Either keeper booting the ball upfield after a moment. Without this a keeper
 * that gathers the ball would stand on it forever, since keepers never attack
 * and the player's keeper is waiting on a kick that may never come.
 */
function clearKeeperBall(state: MatchState, dt: number): void {
  const owner = state.ball.owner;
  if (!owner || !owner.isKeeper || state.phase !== 'play') return;

  owner.ponder += dt;
  if (owner.ponder < KEEPER_CLEAR_TIME) return;
  owner.ponder = 0;

  // Aim at an outfield teammate if there is one, otherwise just hoof it upfield.
  const mate = state.cats.find((c) => c.team === owner.team && !c.isKeeper);
  const fwd = owner.team === 0 ? -1 : 1;
  const aim = mate ? mate.pos : { x: PITCH.w / 2, y: owner.pos.y + fwd * 60 };
  const angle = Math.atan2(aim.y - owner.pos.y, aim.x - owner.pos.x) + randRange(-0.12, 0.12);
  kickBall(state, owner, { x: Math.cos(angle), y: Math.sin(angle) }, MAX_KICK * 0.8);
}
