import { GOALS_TO_WIN, TEAM_RING } from '../game/constants';
import { initAudio, sfxTap } from '../game/audio';
import { Match } from '../game/match';
import { el } from './dom';
import type { AppContext, Screen } from './context';
import type { MatchState, TeamId } from '../game/types';

export function createMatchScreen(app: AppContext): Screen {
  let match: Match | null = null;
  let hintTimer = 0;

  const canvas = el('canvas', { id: 'pitch' }) as HTMLCanvasElement;

  const homeName = el('span', { text: 'You' });
  const awayName = el('span', { text: 'Rivals' });
  const scoreText = el('span.scoreboard__score', { text: '0 - 0' });

  const homePip = el('span.scoreboard__pip');
  homePip.style.background = TEAM_RING[0];
  const awayPip = el('span.scoreboard__pip');
  awayPip.style.background = TEAM_RING[1];

  const scoreboard = el('div.scoreboard', {},
    el('span.scoreboard__side', {}, homePip, homeName),
    scoreText,
    el('span.scoreboard__side', {}, awayName, awayPip),
  );

  const pauseBtn = el('button.btn.btn--ghost.btn--icon', { type: 'button', 'aria-label': 'Pause' }, '❚❚') as HTMLButtonElement;

  const bannerText = el('div.banner__text');
  const bannerSub = el('div.banner__sub');
  const banner = el('div.banner', { hidden: true }, el('div', {}, bannerText, bannerSub));

  const hint = el('div.hint', { hidden: true }, 'Drag to kick!');

  // ---- pause card ---------------------------------------------------------

  const resumeBtn = el('button.btn.btn--primary', { type: 'button' }, 'Keep playing') as HTMLButtonElement;
  const restartBtn = el('button.btn', { type: 'button' }, 'Start again') as HTMLButtonElement;
  const quitBtn = el('button.btn', { type: 'button' }, 'Home') as HTMLButtonElement;
  const pauseOverlay = el('div.overlay', { hidden: true },
    el('div.card', {}, el('h2', { text: 'Paused' }), resumeBtn, restartBtn, quitBtn),
  );

  // ---- result card --------------------------------------------------------

  const resultTitle = el('h2');
  const resultScore = el('div.final-score');
  const againBtn = el('button.btn.btn--primary', { type: 'button' }, 'Play again') as HTMLButtonElement;
  const teamBtn = el('button.btn', { type: 'button' }, 'Change my team') as HTMLButtonElement;
  const homeBtn = el('button.btn', { type: 'button' }, 'Home') as HTMLButtonElement;
  const resultOverlay = el('div.overlay', { hidden: true },
    el('div.card', {}, resultTitle, resultScore, againBtn, teamBtn, homeBtn),
  );

  const root = el('section.screen.screen--match', { hidden: true },
    canvas,
    el('div.hud', {}, pauseBtn, scoreboard),
    banner,
    hint,
    pauseOverlay,
    resultOverlay,
  );

  // ---- wiring -------------------------------------------------------------

  function setPaused(paused: boolean): void {
    match?.setPaused(paused);
    pauseOverlay.hidden = !paused;
    if (paused) hint.hidden = true;
  }

  pauseBtn.addEventListener('click', () => {
    sfxTap();
    setPaused(true);
  });
  resumeBtn.addEventListener('click', () => {
    sfxTap();
    setPaused(false);
  });
  restartBtn.addEventListener('click', () => {
    sfxTap();
    pauseOverlay.hidden = true;
    startMatch();
  });
  quitBtn.addEventListener('click', () => {
    sfxTap();
    app.go('title');
  });
  againBtn.addEventListener('click', () => {
    sfxTap();
    resultOverlay.hidden = true;
    startMatch();
  });
  teamBtn.addEventListener('click', () => {
    sfxTap();
    app.go('builder');
  });
  homeBtn.addEventListener('click', () => {
    sfxTap();
    app.go('title');
  });

  function updateScoreboard(state: MatchState): void {
    scoreText.textContent = `${state.score[0]} - ${state.score[1]}`;
  }

  function updateBanner(state: MatchState): void {
    switch (state.phase) {
      case 'kickoff':
        bannerText.textContent = 'Ready?';
        bannerSub.textContent = `First to ${GOALS_TO_WIN} goals`;
        banner.hidden = false;
        break;
      case 'goal':
        bannerText.textContent = 'GOAL!';
        bannerSub.textContent = state.lastScorer === 0 ? 'Nice one!' : `${state.rivalName} scored`;
        banner.hidden = false;
        break;
      default:
        banner.hidden = true;
    }
  }

  function showResult(winner: TeamId, state: MatchState): void {
    resultTitle.textContent = winner === 0 ? 'You win! 🏆' : `${state.rivalName} win`;
    resultScore.textContent = `${state.score[0]} - ${state.score[1]}`;
    resultOverlay.hidden = false;
    banner.hidden = true;
    hint.hidden = true;
  }

  function startMatch(): void {
    match?.destroy();
    resultOverlay.hidden = true;
    pauseOverlay.hidden = true;
    initAudio();

    const team = app.getTeam();
    homeName.textContent = team.name;

    match = new Match(canvas, team, app.getDifficulty(), {
      onStateChange: (state) => {
        updateScoreboard(state);
        updateBanner(state);
      },
      onFinish: (winner) => {
        const state = match?.state;
        if (state) showResult(winner, state);
      },
    });
    awayName.textContent = match.state.rivalName;
    updateScoreboard(match.state);
    updateBanner(match.state);
    match.start();
  }

  /**
   * The prompt only helps while the player has the ball and is not already
   * aiming, so it is polled rather than driven from the render loop.
   */
  function pollHint(): void {
    const state = match?.state;
    if (!state || !pauseOverlay.hidden || !resultOverlay.hidden) {
      hint.hidden = true;
      return;
    }
    const mine = state.phase === 'play' && state.ball.owner?.team === 0;
    hint.hidden = !mine || state.aim.active;
  }

  return {
    root,
    onShow(): void {
      startMatch();
      hintTimer = window.setInterval(pollHint, 150);
    },
    onBackground(): void {
      // Only pause a match that is actually in progress.
      if (match && resultOverlay.hidden) setPaused(true);
    },
    onHide(): void {
      window.clearInterval(hintTimer);
      match?.destroy();
      match = null;
      hint.hidden = true;
      banner.hidden = true;
      pauseOverlay.hidden = true;
      resultOverlay.hidden = true;
    },
  };
}
