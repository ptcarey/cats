import type { Difficulty, TeamProfile } from '../game/types';

export type ScreenName = 'title' | 'builder' | 'match';

export interface AppContext {
  getTeam(): TeamProfile;
  setTeam(team: TeamProfile): void;
  getDifficulty(): Difficulty;
  setDifficulty(d: Difficulty): void;
  go(screen: ScreenName): void;
}

export interface Screen {
  root: HTMLElement;
  /** Called every time the screen becomes visible. */
  onShow?(): void;
  /** Called when leaving, so a screen can stop its loop. */
  onHide?(): void;
  /** Called when the tab is backgrounded, so a match does not run unseen. */
  onBackground?(): void;
}
