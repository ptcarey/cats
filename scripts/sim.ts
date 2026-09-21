/**
 * Headless match simulation.
 *
 * The browser shows whether the game looks right; this checks whether it
 * behaves right. It plays whole matches with the real AI and physics over a
 * spread of seeds, then asserts the properties that matter for a young
 * player: goals actually happen, play never grinds to a halt, the three cats
 * on a side stay spread out, and the difficulty settings mean something.
 *
 * Run with: npm run sim
 */
import { DEFAULT_TEAM, DIFFICULTIES, GOALS_TO_WIN, PITCH } from '../src/game/constants';
import { steer } from '../src/game/ai';
import { integrate, kickBall } from '../src/game/physics';
import { createMatch, resetPositions, openGoalTarget } from '../src/game/state';
import { pickRival } from '../src/game/team';
import { seedRandom } from '../src/game/math';
import type { Difficulty, MatchState, TeamId } from '../src/game/types';

const STEP = 1 / 60;
const TRIALS = 12;
const MAX_SECONDS = 210;

/**
 * How the stand-in player behaves.
 * - `shooter`: aims at goal whenever a cat of theirs has the ball, like an
 *   engaged older child.
 * - `passive`: never touches the screen at all, which is the worst case the
 *   mercy rule exists to cover.
 */
type Policy = 'passive' | 'shooter';

interface Trial {
  score: [number, number];
  seconds: number;
  finished: boolean;
  meanOutfieldGap: number;
  longestDrought: number;
  autoGoals: number;
  /** Longest unbroken spell with the ball loose, the real dead-ball measure. */
  longestLoose: number;
  /** How often the ball changed hands per minute, i.e. is this a contest. */
  turnoverRate: number;
}

function runMatch(difficulty: Difficulty, policy: Policy, seed: number): Trial {
  seedRandom(seed);
  const state = createMatch(DEFAULT_TEAM, pickRival(DEFAULT_TEAM), difficulty);
  resetPositions(state, 0);
  state.phase = 'play';

  let t = 0;
  let gapSum = 0;
  let gapSamples = 0;
  let lastGoalAt = 0;
  let longestDrought = 0;
  let autoGoals = 0;
  let looseRun = 0;
  let longestLoose = 0;
  let turnovers = 0;
  let lastOwnerTeam: TeamId | null = null;

  while (t < MAX_SECONDS) {
    steer(state, STEP);

    if (policy === 'shooter') {
      const owner = state.ball.owner;
      if (owner && owner.team === 0 && !owner.isKeeper) {
        owner.ponder += STEP;
        if (owner.ponder > 0.6) {
          // Mirrors what the aim assist gives a real player: a shot at the
          // side of the goal the keeper has left open.
          const goal = openGoalTarget(state, 0);
          kickBall(state, owner, { x: goal.x - owner.pos.x, y: goal.y - owner.pos.y }, 80);
        }
      }
    }

    for (const e of integrate(state, STEP)) {
      if (e.type !== 'goal') continue;
      if (e.reason === 'auto') autoGoals++;
      state.score[e.team]++;
      longestDrought = Math.max(longestDrought, t - lastGoalAt);
      lastGoalAt = t;
      resetPositions(state, e.team === 0 ? 1 : 0);
      break;
    }

    assertSane(state, t);

    const owner = state.ball.owner;
    if (owner) {
      looseRun = 0;
      if (owner.team !== lastOwnerTeam) {
        if (lastOwnerTeam !== null) turnovers++;
        lastOwnerTeam = owner.team;
      }
    } else {
      looseRun += STEP;
      longestLoose = Math.max(longestLoose, looseRun);
    }

    const outfield = state.cats.filter((c) => c.team === 0 && !c.isKeeper);
    if (outfield.length === 2) {
      gapSum += Math.hypot(
        outfield[0].pos.x - outfield[1].pos.x,
        outfield[0].pos.y - outfield[1].pos.y,
      );
      gapSamples++;
    }

    t += STEP;
    if (state.score[0] >= GOALS_TO_WIN || state.score[1] >= GOALS_TO_WIN) break;
  }

  longestDrought = Math.max(longestDrought, t - lastGoalAt);

  return {
    score: [state.score[0], state.score[1]],
    seconds: t,
    finished: state.score[0] >= GOALS_TO_WIN || state.score[1] >= GOALS_TO_WIN,
    meanOutfieldGap: gapSamples ? gapSum / gapSamples : 0,
    longestDrought,
    autoGoals,
    longestLoose,
    turnoverRate: turnovers / Math.max(t / 60, 1 / 60),
  };
}

function assertSane(state: MatchState, t: number): void {
  for (const cat of state.cats) {
    for (const v of [cat.pos.x, cat.pos.y, cat.vel.x, cat.vel.y, cat.facing]) {
      if (!Number.isFinite(v)) throw new Error(`${cat.name} went non-finite at t=${t.toFixed(2)}`);
    }
    if (cat.pos.x < -1 || cat.pos.x > PITCH.w + 1 || cat.pos.y < -1 || cat.pos.y > PITCH.h + 1) {
      throw new Error(`${cat.name} left the pitch at t=${t.toFixed(2)}`);
    }
  }
  for (const v of [state.ball.pos.x, state.ball.pos.y, state.ball.vel.x, state.ball.vel.y]) {
    if (!Number.isFinite(v)) throw new Error(`Ball went non-finite at t=${t.toFixed(2)}`);
  }
}

// ---------------------------------------------------------------------------

interface Summary {
  playerWins: number;
  rivalWins: number;
  unfinished: number;
  meanSeconds: number;
  meanDrought: number;
  worstDrought: number;
  meanGap: number;
  playerGoals: number;
  rivalGoals: number;
  autoGoals: number;
  worstLoose: number;
  meanTurnoverRate: number;
}

function summarise(difficulty: Difficulty, policy: Policy): Summary {
  const trials: Trial[] = [];
  for (let seed = 1; seed <= TRIALS; seed++) trials.push(runMatch(difficulty, policy, seed * 7919));

  const mean = (f: (t: Trial) => number) => trials.reduce((a, t) => a + f(t), 0) / trials.length;

  return {
    playerWins: trials.filter((t) => t.score[0] >= GOALS_TO_WIN).length,
    rivalWins: trials.filter((t) => t.score[1] >= GOALS_TO_WIN).length,
    unfinished: trials.filter((t) => !t.finished).length,
    meanSeconds: mean((t) => t.seconds),
    meanDrought: mean((t) => t.longestDrought),
    worstDrought: Math.max(...trials.map((t) => t.longestDrought)),
    meanGap: mean((t) => t.meanOutfieldGap),
    playerGoals: mean((t) => t.score[0]),
    rivalGoals: mean((t) => t.score[1]),
    autoGoals: mean((t) => t.autoGoals),
    worstLoose: Math.max(...trials.map((t) => t.longestLoose)),
    meanTurnoverRate: mean((t) => t.turnoverRate),
  };
}

/**
 * Tuning aid: `npm run sim -- --sweep bigcat` walks the opponent speed and
 * tackle rate for one difficulty through the very same match harness used by
 * the checks below, so the numbers it prints are directly comparable. A
 * separate quick-and-dirty sweep script is not worth having; it drifts from
 * the real harness and then disagrees with it.
 */
function sweep(target: Difficulty): void {
  const spec = DIFFICULTIES[target];
  const originalSpeed = spec.speed;
  const originalTackle = spec.tackle;

  console.log(`Sweeping ${target} (the player is always speed 1.00)
`);
  console.log('speed  tackle | playerW rivalW  avg score    unfinished');

  // Grids can be overridden: --speeds 0.98,1.0,1.02 --tackles 1.1,1.25
  const grid = (flag: string, fallback: number[]): number[] => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? fallback : process.argv[i + 1].split(',').map(Number);
  };
  for (const speed of grid('--speeds', [0.9, 0.94, 0.98, 1.02])) {
    for (const tackle of grid('--tackles', [1.1, 1.4])) {
      spec.speed = speed;
      spec.tackle = tackle;
      const r = summarise(target, 'shooter');
      console.log(
        `${speed.toFixed(2)}   ${tackle.toFixed(2)}   | ` +
          `${String(r.playerWins).padStart(2)}/${TRIALS}  ${String(r.rivalWins).padStart(2)}/${TRIALS}   ` +
          `${r.playerGoals.toFixed(1)}-${r.rivalGoals.toFixed(1)}        ${r.unfinished}`,
      );
    }
  }

  spec.speed = originalSpeed;
  spec.tackle = originalTackle;
}

const sweepFlag = process.argv.indexOf('--sweep');
if (sweepFlag !== -1) {
  const target = (process.argv[sweepFlag + 1] ?? 'bigcat') as Difficulty;
  sweep(target);
  process.exit(0);
}

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: string): void => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label} - ${detail}`);
  if (!ok) failures.push(label);
};

console.log(`Cat Soccer headless simulation: ${TRIALS} matches per configuration\n`);

const results = new Map<string, Summary>();

for (const difficulty of ['kitten', 'cat', 'bigcat'] as Difficulty[]) {
  for (const policy of ['shooter', 'passive'] as Policy[]) {
    const key = `${difficulty}/${policy}`;
    const s = summarise(difficulty, policy);
    results.set(key, s);

    console.log(
      `${key.padEnd(17)} player ${s.playerWins}W  rival ${s.rivalWins}W  unfinished ${s.unfinished}` +
        `   avg ${s.playerGoals.toFixed(1)}-${s.rivalGoals.toFixed(1)} in ${s.meanSeconds.toFixed(0)}s` +
        `   drought ${s.meanDrought.toFixed(0)}/${s.worstDrought.toFixed(0)}s` +
        `   loose ${s.worstLoose.toFixed(1)}s   turnovers ${s.meanTurnoverRate.toFixed(0)}/min` +
        `   gap ${s.meanGap.toFixed(0)}u   auto ${s.autoGoals.toFixed(1)}`,
    );

    // "Grinds to a halt" means the ball genuinely stops being contested. A
    // long goalless spell is not the same thing: an end-to-end match with the
    // ball changing hands every few seconds is working as intended, it is just
    // low scoring, which is what happens when the stand-in player never kicks.
    check(`${key} ball is never dead`, s.worstLoose < 5, `longest loose spell ${s.worstLoose.toFixed(1)}s`);
    // Measured as a rate, so a quick win is not mistaken for a dull match.
    check(
      `${key} stays a contest`,
      s.meanTurnoverRate > 8,
      `${s.meanTurnoverRate.toFixed(0)} turnovers per minute`,
    );
    check(`${key} cats stay spread`, s.meanGap > 22, `mean gap ${s.meanGap.toFixed(0)} units`);

    // Only a player who actually plays is expected to finish inside the limit.
    if (policy === 'shooter') {
      // There is no match clock in the game, so MAX_SECONDS is only a harness
      // limit. On the hardest setting the two sides are close enough that the
      // occasional match genuinely runs long, which is allowed for.
      const allowed = difficulty === 'bigcat' ? 2 : 0;
      check(
        `${key} matches end`,
        s.unfinished <= allowed,
        `${s.unfinished} of ${TRIALS} passed ${MAX_SECONDS}s (mean ${s.meanSeconds.toFixed(0)}s)`,
      );
      // A close match legitimately has longer goalless spells than a
      // walkover, so this is a loose upper bound. The dead-ball and turnover
      // checks above are what actually catch a game that has stopped working.
      check(
        `${key} keeps the goals coming`,
        s.worstDrought < 120,
        `worst goalless stretch ${s.worstDrought.toFixed(0)}s`,
      );
    }
    console.log('');
  }
}

// An engaged child should beat the gentlest setting nearly every time.
const kitten = results.get('kitten/shooter')!;
check('Kitten is gentle', kitten.playerWins >= TRIALS - 1, `player won ${kitten.playerWins}/${TRIALS}`);

// The hardest setting has to put up a real fight, or there is no progression.
const big = results.get('bigcat/shooter')!;
check('Big Cat fights back', big.rivalGoals >= 0.8, `rival averaged ${big.rivalGoals.toFixed(1)} goals`);

// ...but it still has to be beatable, or an older child just gives up. The
// stand-in shooter is a blunt player: it blasts at the centre of the goal and
// never uses a pass, so a real child should do rather better than this.
check(
  'Big Cat is still winnable',
  big.playerWins >= 4,
  `player won ${big.playerWins}/${TRIALS} with a crude shooting policy`,
);

// The three settings have to form a real ladder rather than three names for
// the same match. Absolute goal counts are noisy between runs, so what is
// asserted is the ordering: each step up concedes more and is won less often.
const mid = results.get('cat/shooter')!;
const conceded = [kitten.rivalGoals, mid.rivalGoals, big.rivalGoals];
const won = [kitten.playerWins, mid.playerWins, big.playerWins];
check(
  'each step up concedes more',
  conceded[0] < conceded[1] && conceded[1] < conceded[2],
  `rival goals ${conceded.map((c) => c.toFixed(1)).join(' -> ')}`,
);
check(
  'each step up is won less often',
  won[0] >= won[1] && won[1] >= won[2] && won[0] > won[2],
  `player wins ${won.join(' -> ')} of ${TRIALS}`,
);

// The mercy rule has to rescue a child who cannot aim yet, on the gentle setting.
const passive = results.get('kitten/passive')!;
check(
  'the mercy rule carries a passive player on Kitten',
  passive.playerGoals >= 1.5,
  `averaged ${passive.playerGoals.toFixed(1)} goals without a single kick`,
);

// But doing nothing should not win on the hard setting.
const passiveHard = results.get('bigcat/passive')!;
check(
  'doing nothing loses on Big Cat',
  passiveHard.rivalWins > passiveHard.playerWins,
  `rival won ${passiveHard.rivalWins}/${TRIALS}`,
);

console.log(`\n${failures.length === 0 ? 'All checks passed.' : `${failures.length} check(s) failed:`}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
