import { createTitleScreen } from './titleScreen';
import { createBuilderScreen } from './builderScreen';
import { createMatchScreen } from './matchScreen';
import { loadDifficulty, loadTeam, saveDifficulty, saveTeam } from './storage';
import type { AppContext, Screen, ScreenName } from './context';
import type { Difficulty, TeamProfile } from '../game/types';

export function mountApp(root: HTMLElement): void {
  let team: TeamProfile = loadTeam();
  let difficulty: Difficulty = loadDifficulty();
  let currentName: ScreenName = 'title';

  const screens = {} as Record<ScreenName, Screen>;

  const context: AppContext = {
    getTeam: () => team,
    setTeam(next) {
      team = next;
      saveTeam(next);
    },
    getDifficulty: () => difficulty,
    setDifficulty(next) {
      difficulty = next;
      saveDifficulty(next);
    },
    go(name) {
      show(name, true);
    },
  };

  screens.title = createTitleScreen(context);
  screens.builder = createBuilderScreen(context);
  screens.match = createMatchScreen(context);

  for (const screen of Object.values(screens)) root.append(screen.root);

  function show(name: ScreenName, pushHistory: boolean): void {
    if (name === currentName && screens[name].root.hidden === false) return;

    const leaving = screens[currentName];
    leaving.onHide?.();
    leaving.root.hidden = true;

    currentName = name;
    const entering = screens[name];
    entering.root.hidden = false;
    entering.onShow?.();

    // One history entry away from the title, so Android back returns here
    // instead of closing the app.
    if (pushHistory) {
      if (name === 'title') {
        if (history.state?.screen) history.replaceState({ screen: 'title' }, '');
      } else {
        history.pushState({ screen: name }, '');
      }
    }
  }

  window.addEventListener('popstate', () => {
    if (currentName !== 'title') show('title', false);
  });

  // Pausing on tab switch stops a match running unseen in the background.
  // A page that has never been visible is not worth pausing, which also keeps
  // embedded and headless contexts from pausing the game the instant it opens.
  let everVisible = document.visibilityState === 'visible';
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      everVisible = true;
      return;
    }
    if (everVisible) screens[currentName].onBackground?.();
  });

  history.replaceState({ screen: 'title' }, '');
  show('title', false);
}
