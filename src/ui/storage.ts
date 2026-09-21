import { CAT_NAMES, DEFAULT_TEAM, PALETTE, PATTERNS, TEAM_NAMES } from '../game/constants';
import { pick } from '../game/math';
import type { Difficulty, Pattern, TeamProfile } from '../game/types';

// v2 moved colours from each cat onto the team, so the old key is not reused.
const TEAM_KEY = 'cats:team:v2';
const DIFF_KEY = 'cats:difficulty:v1';

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const PATTERN_IDS: readonly Pattern[] = PATTERNS.map((p) => p.id);

/** Rebuilds a stored team defensively, so a corrupt or old entry cannot break startup. */
function sanitise(raw: unknown): TeamProfile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const colors = Array.isArray(obj.colors) ? obj.colors.filter(isHex).slice(0, 3) : [];
  if (colors.length === 0) return null;

  const pattern = PATTERN_IDS.includes(obj.pattern as Pattern) ? (obj.pattern as Pattern) : 'solid';

  const rawNames = Array.isArray(obj.catNames) ? obj.catNames : [];
  const catNames = [0, 1, 2].map((i) => {
    const n = rawNames[i];
    return typeof n === 'string' && n.trim() ? n.trim().slice(0, 12) : CAT_NAMES[i];
  }) as [string, string, string];

  const name =
    typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 18) : 'My Team';

  return { name, pattern, colors, catNames };
}

export function loadTeam(): TeamProfile {
  try {
    const raw = localStorage.getItem(TEAM_KEY);
    if (!raw) return structuredClone(DEFAULT_TEAM);
    return sanitise(JSON.parse(raw)) ?? structuredClone(DEFAULT_TEAM);
  } catch {
    return structuredClone(DEFAULT_TEAM);
  }
}

export function saveTeam(team: TeamProfile): void {
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(team));
  } catch {
    // Private browsing or a full quota. The team just will not persist.
  }
}

export function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    if (v === 'kitten' || v === 'cat' || v === 'bigcat') return v;
  } catch {
    // Fall through to the gentlest setting.
  }
  return 'kitten';
}

export function saveDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFF_KEY, d);
  } catch {
    // Not persisting a difficulty is harmless.
  }
}

export function randomName(): string {
  return pick(CAT_NAMES);
}

export function randomTeam(): TeamProfile {
  const count = 1 + Math.floor(Math.random() * 3);
  const colors: string[] = [];
  while (colors.length < count) {
    const hex = pick(PALETTE).hex;
    if (!colors.includes(hex)) colors.push(hex);
  }

  const catNames: string[] = [];
  while (catNames.length < 3) {
    const n = pick(CAT_NAMES);
    if (!catNames.includes(n)) catNames.push(n);
  }

  return {
    name: pick(TEAM_NAMES),
    pattern: pick(PATTERNS).id,
    colors,
    catNames: catNames as [string, string, string],
  };
}
