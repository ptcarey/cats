import type { CatSkin, Difficulty, TeamProfile } from './types';

/**
 * The pitch is defined in its own unit space and scaled to fit the screen,
 * so nothing in the simulation depends on pixels or device size.
 * Team 0 (the player) attacks upward, toward y = 0.
 */
export const PITCH = { w: 100, h: 158 } as const;

/** Extra space drawn above and below the pitch for the goal nets. */
export const MARGIN = { x: 4, y: 13 } as const;

export const GOAL_WIDTH = 36;
export const GOAL_DEPTH = 9;
export const GOAL_X0 = (PITCH.w - GOAL_WIDTH) / 2;
export const GOAL_X1 = GOAL_X0 + GOAL_WIDTH;

export const CAT_RADIUS = 2.8;
export const BALL_RADIUS = 1.6;

/** How far in front of a cat the held ball sits. */
export const DRIBBLE_OFFSET = CAT_RADIUS + BALL_RADIUS + 0.6;

/**
 * Ball deceleration, modelled as a rolling ball: a constant rolling
 * resistance plus a small speed-proportional drag. The constant term is what
 * matters. It makes carry grow with the square of kick speed, so a hard shot
 * from midfield still reaches the goal while a soft pass stops after a few
 * lengths. The old speed-proportional model made carry linear, and long
 * shots died well short of the net.
 *
 * `carryDistance` and `kickSpeedForDistance` in physics.ts are the two
 * directions of this model; use them rather than hand-tuned power formulas.
 */
export const ROLL_DECEL = 30;
export const BALL_DRAG = 0.32;
export const BALL_MAX_SPEED = 130;
export const WALL_BOUNCE = 0.62;
export const CAT_BOUNCE = 0.55;

export const MIN_KICK = 36;
export const MAX_KICK = 100;

/** Ball must be slower than this (relative to the cat) to be collected. */
export const COLLECT_SPEED = 72;

/**
 * Reach, deliberately not derived from body size. The extra margin is an
 * assist for young players rather than anatomy: it is what makes a slightly
 * misjudged pass still get collected. Shrinking the cats on screen should not
 * quietly make the game harder, so these stay at a fixed generous distance.
 */
export const COLLECT_RADIUS = CAT_RADIUS + BALL_RADIUS + 5.0;

export const TACKLE_RADIUS = CAT_RADIUS * 2 + 5.0;
export const TACKLE_TIME = 0.42;
export const TACKLE_STUN = 0.75;

/**
 * How far apart teammates try to stay, in pitch units rather than body
 * lengths, so the spread is a property of the pitch and not of how big the
 * cats happen to be drawn.
 */
export const SEPARATION_RADIUS = 23;
export const SEPARATION_FORCE = 0.85;

/**
 * Mercy rule. Hold the ball this long near the goal you are attacking and it
 * goes in by itself, so a young player who cannot aim yet still scores.
 */
export const AUTO_GOAL_TIME = 3.0;
export const AUTO_GOAL_RADIUS = 36;
/**
 * How fast the charge bleeds away once the pressure stops, relative to how
 * fast it builds. Below 1 so that briefly losing the ball costs progress
 * without throwing it all away, which matters when a child is being swarmed.
 */
export const AUTO_GOAL_DECAY = 0.6;

/**
 * How far from goal a cat carrying the ball holds up and waits. Without this
 * the AI would simply dribble the ball over the line and the player would
 * never need to do anything.
 */
export const HOLD_RANGE = 24;

/**
 * A pass is struck a little too hard or too soft at random. Overhit passes
 * run past the receiver, which is the other way possession changes hands.
 */
export const PASS_POWER_MIN = 0.92;
export const PASS_POWER_MAX = 1.18;

export const GOALS_TO_WIN = 3;

/** Longest useful drag, as a fraction of the screen's short side. */
export const MAX_DRAG_FRACTION = 0.34;
export const AIM_TIME_SCALE = 0.22;

/** Aim snapping: how far off a target the drag may point and still lock on. */
export const SNAP_ANGLE = 0.30;

export interface DifficultySpec {
  label: string;
  blurb: string;
  /** Opponent movement speed multiplier. */
  speed: number;
  /** Seconds an opponent holds the ball before acting. Higher is easier. */
  ponder: number;
  /** Radians of random error added to opponent kicks. Higher is easier. */
  spread: number;
  /** Opponent tackle time multiplier. Higher is easier. */
  tackle: number;
  /** How far out the opponent will take a shot. Further is harder to defend. */
  shootRange: number;
  /**
   * Radians of random error on the player's passes. Passes are meant to go
   * astray sometimes, otherwise possession is never really contested; on the
   * gentle setting they are nearly always safe.
   */
  passSpread: number;
}

/**
 * Tuned against scripts/sim.ts. `speed` is by far the strongest lever and is
 * sharply non-linear, because whichever side is quicker reaches every loose
 * ball first. Note that CAT_RADIUS feeds into this too: larger cats block
 * more shots and cover more ground, so changing the cat size shifts the whole
 * ladder. After touching either, re-run `npm run sim` and expect to move
 * these speeds in steps of about 0.03.
 */
export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  kitten: { label: 'Kitten', blurb: 'Nice and gentle', speed: 0.80, ponder: 1.10, spread: 0.26, tackle: 1.7, shootRange: 36, passSpread: 0.04 },
  cat: { label: 'Cat', blurb: 'A fair match', speed: 0.90, ponder: 0.75, spread: 0.14, tackle: 1.1, shootRange: 48, passSpread: 0.08 },
  bigcat: { label: 'Big Cat', blurb: 'Really tricky', speed: 1.01, ponder: 0.55, spread: 0.10, tackle: 1.2, shootRange: 60, passSpread: 0.12 },
};

export const CAT_SPEED = 24.0;
export const CAT_ACCEL = 88;

/** Kid-friendly coat colours. Deliberately avoids pitch green so cats stay visible. */
export const PALETTE: readonly { name: string; hex: string }[] = [
  { name: 'Ginger', hex: '#f0833a' },
  { name: 'Marmalade', hex: '#d95f18' },
  { name: 'Cream', hex: '#f7e3c0' },
  { name: 'Snow', hex: '#fbfbfb' },
  { name: 'Smoke', hex: '#b9c0c9' },
  { name: 'Slate', hex: '#6d7783' },
  { name: 'Midnight', hex: '#33383f' },
  { name: 'Cocoa', hex: '#7b5137' },
  { name: 'Caramel', hex: '#c69257' },
  { name: 'Bubblegum', hex: '#ff8fbe' },
  { name: 'Grape', hex: '#9b6ddb' },
  { name: 'Sky', hex: '#5bb8f0' },
  { name: 'Ocean', hex: '#2f7fd0' },
  { name: 'Mint', hex: '#67dcb4' },
  { name: 'Lemon', hex: '#ffd93d' },
];

export const PATTERNS: readonly { id: CatSkin['pattern']; label: string }[] = [
  { id: 'solid', label: 'Plain' },
  { id: 'tabby', label: 'Stripes' },
  { id: 'patches', label: 'Spots' },
  { id: 'tuxedo', label: 'Socks' },
];

export const CAT_NAMES: readonly string[] = [
  'Mittens', 'Biscuit', 'Pickle', 'Noodle', 'Waffles', 'Pumpkin', 'Sprout',
  'Mochi', 'Peanut', 'Tofu', 'Snickers', 'Blossom', 'Dusty', 'Marmite',
  'Jellybean', 'Bandit', 'Freckle', 'Nugget', 'Pepper', 'Muffin',
];

export const TEAM_NAMES: readonly string[] = [
  'The Whiskers', 'Paw Rangers', 'Furballs FC', 'The Pouncers',
  'Midnight Miaows', 'Claw United', 'The Zoomies', 'Sock Stealers',
];

/**
 * Possible computer sides. Each team wears one look so children can tell the
 * sides apart by colour alone; `pickRival` chooses whichever contrasts most
 * with the colours the player picked.
 */
export const RIVAL_PRESETS: readonly TeamProfile[] = [
  {
    name: 'The Alley Cats',
    pattern: 'solid',
    colors: ['#33383f', '#5c6470', '#ffd93d'],
    catNames: ['Rocket', 'Scruff', 'Boots'],
  },
  {
    name: 'The Gingers',
    pattern: 'tabby',
    colors: ['#f0833a', '#d95f18', '#f7e3c0'],
    catNames: ['Rusty', 'Tiger', 'Pumpkin'],
  },
  {
    name: 'The Bluebells',
    pattern: 'solid',
    colors: ['#2f7fd0', '#5bb8f0', '#fbfbfb'],
    catNames: ['Splash', 'Denim', 'Misty'],
  },
];

/** The default player team: a ginger tabby side. */
export const DEFAULT_TEAM: TeamProfile = {
  name: 'The Whiskers',
  pattern: 'tabby',
  colors: ['#f0833a', '#d95f18', '#f7e3c0'],
  catNames: ['Biscuit', 'Pickle', 'Mittens'],
};

export const TEAM_RING = ['#ffe14d', '#ff5d73'] as const;
export const TEAM_LABEL = ['Your team', 'Alley Cats'] as const;
