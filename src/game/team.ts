import { RIVAL_PRESETS } from './constants';
import { colorDistance } from './color';
import type { CatProfile, TeamProfile } from './types';

/** The third cat on every team keeps goal. */
export const KEEPER_INDEX = 2;

/**
 * Builds one cat's look from the team palette. Outfield cats wear the team
 * colours; the keeper wears a white coat marked with them, which is both a
 * real soccer convention and an easy way for a child to spot the keeper.
 */
export function catLook(team: TeamProfile, index: number): CatProfile {
  const base = team.colors.length ? team.colors : ['#f0833a'];
  const name = team.catNames[index] ?? `Cat ${index + 1}`;

  if (index === KEEPER_INDEX) {
    return {
      name,
      skin: { pattern: 'patches', colors: ['#fbfbfb', base[0], base[1] ?? base[0]] },
    };
  }

  return { name, skin: { pattern: team.pattern, colors: [...base] } };
}

export function teamLooks(team: TeamProfile): CatProfile[] {
  return [0, 1, 2].map((i) => catLook(team, i));
}

/** Below this the two coats are too alike to tell apart mid-match. */
const MIN_TEAM_CONTRAST = 170;

/**
 * Picks the computer side. The presets are tried in order, so the black Alley
 * Cats are the usual opponent; a later preset is only used when the player has
 * chosen colours too close to the earlier ones to tell the sides apart.
 */
export function pickRival(player: TeamProfile): TeamProfile {
  const coat = player.colors[0] ?? '#f0833a';

  for (const preset of RIVAL_PRESETS) {
    if (colorDistance(coat, preset.colors[0]) >= MIN_TEAM_CONTRAST) return preset;
  }

  // Everything clashes, so fall back to whichever preset is least similar.
  let best = RIVAL_PRESETS[0];
  let bestScore = -Infinity;
  for (const preset of RIVAL_PRESETS) {
    const score = colorDistance(coat, preset.colors[0]);
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }
  return best;
}
