export interface Vec {
  x: number;
  y: number;
}

/** Fur patterns a player can choose in the team builder. */
export type Pattern = 'solid' | 'tabby' | 'patches' | 'tuxedo';

/**
 * A cat's look. `colors` holds 1 to 3 entries: the player picks how many.
 * Slot 0 is the coat, slot 1 the markings, slot 2 the ears/paws/tail-tip.
 * Missing slots are derived in `resolveSkin` so every cat still reads clearly.
 */
export interface CatSkin {
  pattern: Pattern;
  colors: string[];
}

export interface CatProfile {
  name: string;
  skin: CatSkin;
}

/**
 * A whole team shares one look, so a child can tell the sides apart at a
 * glance. The player chooses the pattern and up to three colours once; every
 * cat on the team wears them. The keeper is drawn as a white variant of the
 * same palette.
 */
export interface TeamProfile {
  name: string;
  pattern: Pattern;
  /** 1 to 3 entries, applied to every cat on the team. */
  colors: string[];
  catNames: [string, string, string];
}

export type TeamId = 0 | 1;
export type Role = 'chase' | 'support' | 'defend';

export interface Cat {
  id: number;
  team: TeamId;
  name: string;
  skin: CatSkin;
  pos: Vec;
  vel: Vec;
  /** Direction the cat is drawn facing, in radians. Eased toward travel direction. */
  facing: number;
  role: Role;
  /** Seconds of lost control after being tackled. Cannot hold the ball while > 0. */
  stun: number;
  /** Blocks instantly re-collecting a ball this cat just kicked. */
  kickCooldown: number;
  /** Seconds this cat has been pressing the opposing ball carrier. */
  tackle: number;
  /** The keeper stays home and never joins the attack. */
  isKeeper: boolean;
  /** Drives the paw and tail animation. */
  animPhase: number;
  /** Seconds the AI has held the ball, used to delay its decision. */
  ponder: number;
}

export interface Ball {
  pos: Vec;
  vel: Vec;
  owner: Cat | null;
  /** Visual only: makes the ball look like it is rolling. */
  roll: number;
}

export type Phase = 'kickoff' | 'play' | 'goal' | 'fulltime';

export interface AimTarget {
  kind: 'teammate' | 'goal' | 'free';
  pos: Vec;
  cat?: Cat;
}

export interface AimState {
  active: boolean;
  /** Where the finger currently is, in pitch units. */
  point: Vec;
  target: AimTarget | null;
  power: number;
}

export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type Difficulty = 'kitten' | 'cat' | 'bigcat';

export interface MatchState {
  cats: Cat[];
  ball: Ball;
  score: [number, number];
  phase: Phase;
  /** Counts down the pause on kickoff / after a goal / at full time. */
  phaseTimer: number;
  aim: AimState;
  particles: Particle[];
  difficulty: Difficulty;
  /** 1 normally, dropped while the player is aiming. */
  timeScale: number;
  /** Total seconds elapsed, used for idle animation. */
  elapsed: number;
  /** Set when a goal is scored so the banner knows who to congratulate. */
  lastScorer: TeamId | null;
  shake: number;
  /** Display name of the computer side for this match. */
  rivalName: string;
  /**
   * Tracks the mercy rule: how long the current carrier has camped near the
   * goal they are attacking. Reaching AUTO_GOAL_TIME scores automatically.
   */
  autoGoal: { team: TeamId | null; t: number };
}
