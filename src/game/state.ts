import { GOAL_X0, GOAL_X1, PITCH } from './constants';
import { KEEPER_INDEX, catLook } from './team';
import type { Cat, Difficulty, MatchState, TeamId, TeamProfile, Vec } from './types';
import { random, vec } from './math';

/**
 * Formation for team 0, which attacks toward y = 0. Team 1 is mirrored.
 * The two outfield cats start well apart, which keeps them from immediately
 * clumping around the ball.
 */
const FORMATION: readonly { x: number; y: number }[] = [
  { x: 25, y: 96 },
  { x: 75, y: 114 },
  { x: 50, y: 143 },
];

const mirrorY = (y: number): number => PITCH.h - y;

function makeCat(id: number, team: TeamId, index: number, profile: TeamProfile, x: number, y: number): Cat {
  const look = catLook(profile, index);
  return {
    id,
    team,
    name: look.name,
    skin: look.skin,
    pos: vec(x, y),
    vel: vec(0, 0),
    facing: team === 0 ? -Math.PI / 2 : Math.PI / 2,
    role: index === KEEPER_INDEX ? 'defend' : 'support',
    stun: 0,
    kickCooldown: 0,
    tackle: 0,
    isKeeper: index === KEEPER_INDEX,
    animPhase: random() * Math.PI * 2,
    ponder: 0,
  };
}

export function createMatch(player: TeamProfile, rival: TeamProfile, difficulty: Difficulty): MatchState {
  const cats: Cat[] = [];
  for (let i = 0; i < 3; i++) {
    const spot = FORMATION[i];
    cats.push(makeCat(i, 0, i, player, spot.x, spot.y));
  }
  for (let i = 0; i < 3; i++) {
    const spot = FORMATION[i];
    cats.push(makeCat(3 + i, 1, i, rival, PITCH.w - spot.x, mirrorY(spot.y)));
  }

  return {
    cats,
    ball: { pos: vec(PITCH.w / 2, PITCH.h / 2), vel: vec(0, 0), owner: null, roll: 0 },
    score: [0, 0],
    phase: 'kickoff',
    phaseTimer: 1.6,
    aim: { active: false, point: vec(0, 0), target: null, power: 0 },
    particles: [],
    difficulty,
    timeScale: 1,
    elapsed: 0,
    lastScorer: null,
    shake: 0,
    rivalName: rival.name,
    autoGoal: { team: null, t: 0 },
  };
}

/** Returns everyone to their formation spot and puts the ball back on the centre mark. */
export function resetPositions(state: MatchState, kickoffFor: TeamId): void {
  state.cats.forEach((cat, i) => {
    const spot = FORMATION[i % 3];
    if (cat.team === 0) {
      cat.pos.x = spot.x;
      cat.pos.y = spot.y;
      cat.facing = -Math.PI / 2;
    } else {
      cat.pos.x = PITCH.w - spot.x;
      cat.pos.y = mirrorY(spot.y);
      cat.facing = Math.PI / 2;
    }
    cat.vel.x = 0;
    cat.vel.y = 0;
    cat.stun = 0;
    cat.tackle = 0;
    cat.kickCooldown = 0;
    cat.ponder = 0;
  });

  // Nudge an outfield cat from the kicking-off side onto the centre mark.
  const striker = state.cats.find((c) => c.team === kickoffFor && !c.isKeeper);
  if (striker) {
    striker.pos.x = PITCH.w / 2;
    striker.pos.y = PITCH.h / 2 + (kickoffFor === 0 ? 9 : -9);
  }

  state.ball.pos.x = PITCH.w / 2;
  state.ball.pos.y = PITCH.h / 2;
  state.ball.vel.x = 0;
  state.ball.vel.y = 0;
  state.ball.owner = null;
  state.aim.active = false;
  state.aim.target = null;
  state.timeScale = 1;
  state.autoGoal.team = null;
  state.autoGoal.t = 0;
}

/** The goal that `team` is shooting at. */
export function attackingGoal(team: TeamId): { x: number; y: number } {
  return { x: PITCH.w / 2, y: team === 0 ? 0 : PITCH.h };
}

/** The goal that `team` is defending. */
export function defendingGoal(team: TeamId): { x: number; y: number } {
  return { x: PITCH.w / 2, y: team === 0 ? PITCH.h : 0 };
}

/**
 * The part of the goal mouth the opposing keeper is furthest from.
 *
 * Both the computer's shooting and the player's aim assist use this. Aiming
 * at the centre of the goal means aiming straight at the keeper, so if only
 * one side used it that side would be at a large and invisible disadvantage.
 */
export function openGoalTarget(state: MatchState, team: TeamId): Vec {
  const goal = attackingGoal(team);
  const keeper = state.cats.find((c) => c.team !== team && c.isKeeper);
  if (!keeper) return goal;

  const inset = 6;
  const left = GOAL_X0 + inset;
  const right = GOAL_X1 - inset;
  const x = Math.abs(keeper.pos.x - left) > Math.abs(keeper.pos.x - right) ? left : right;
  return { x, y: goal.y };
}
