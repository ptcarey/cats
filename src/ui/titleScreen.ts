import { DIFFICULTIES } from '../game/constants';
import { initAudio, isMuted, sfxMeow, sfxTap, toggleMute } from '../game/audio';
import { el } from './dom';
import { attachPreview } from './preview';
import { teamLooks } from '../game/team';
import type { AppContext, Screen } from './context';
import type { Difficulty } from '../game/types';

export function createTitleScreen(app: AppContext): Screen {
  const teamName = el('div.team-strip__name');
  const strip = el<HTMLCanvasElement>('canvas');
  const stripWrap = el('div.team-strip', {}, strip, teamName);
  attachPreview(strip, () => teamLooks(app.getTeam()));

  const difficultyChips = new Map<Difficulty, HTMLButtonElement>();
  const chipRow = el('div.chips');
  (Object.keys(DIFFICULTIES) as Difficulty[]).forEach((id) => {
    const spec = DIFFICULTIES[id];
    const chip = el('button.chip', { type: 'button', 'aria-pressed': 'false' },
      spec.label,
      el('small', { text: spec.blurb }),
    ) as HTMLButtonElement;
    chip.addEventListener('click', () => {
      initAudio();
      sfxTap();
      app.setDifficulty(id);
      syncChips();
    });
    difficultyChips.set(id, chip);
    chipRow.append(chip);
  });

  function syncChips(): void {
    const current = app.getDifficulty();
    for (const [id, chip] of difficultyChips) {
      chip.setAttribute('aria-pressed', String(id === current));
    }
  }

  const playBtn = el('button.btn.btn--primary', { type: 'button' }, 'Play!') as HTMLButtonElement;
  playBtn.addEventListener('click', () => {
    initAudio();
    sfxMeow();
    app.go('match');
  });

  const teamBtn = el('button.btn.btn--wide', { type: 'button' }, 'My Team') as HTMLButtonElement;
  teamBtn.addEventListener('click', () => {
    initAudio();
    sfxTap();
    app.go('builder');
  });

  const helpBtn = el('button.btn.btn--ghost.btn--wide', { type: 'button' }, 'How to Play') as HTMLButtonElement;

  const muteBtn = el('button.btn.btn--ghost.btn--icon', {
    type: 'button',
    'aria-label': 'Sound on or off',
  }) as HTMLButtonElement;
  muteBtn.addEventListener('click', () => {
    initAudio();
    const nowMuted = toggleMute();
    muteBtn.textContent = nowMuted ? '🔇' : '🔊';
    if (!nowMuted) sfxTap();
  });

  const help = buildHelpOverlay();
  helpBtn.addEventListener('click', () => {
    initAudio();
    sfxTap();
    help.hidden = false;
  });

  const root = el('section.screen.screen--menu', { hidden: true },
    el('div.stack', {},
      el('h1.title', {}, 'Cat', el('em', { text: 'Soccer' })),
      el('p.subtitle', { text: 'Three cats. One ball. Get it in the net.' }),
      stripWrap,
      playBtn,
      teamBtn,
      el('div.label', { text: 'How hard?' }),
      chipRow,
      el('div.row', {}, helpBtn, muteBtn),
    ),
    help,
  );

  return {
    root,
    onShow(): void {
      teamName.textContent = app.getTeam().name;
      muteBtn.textContent = isMuted() ? '🔇' : '🔊';
      syncChips();
    },
  };
}

function buildHelpOverlay(): HTMLElement {
  const close = el('button.btn.btn--primary', { type: 'button' }, 'Got it!') as HTMLButtonElement;
  const overlay = el('div.overlay', { hidden: true },
    el('div.card', {},
      el('h2', { text: 'How to play' }),
      el('ol', {},
        el('li', { text: 'Your cats run around by themselves. Let them chase the ball.' }),
        el('li', { text: 'When one of your cats gets the ball, put your finger on the screen. Everything slows down.' }),
        el('li', { text: 'Drag toward a teammate or the goal, then let go to kick.' }),
        el('li', { text: 'First team to score 3 goals wins!' }),
      ),
      el('p', { text: 'Your whole team wears your colours. The other team wears a different colour, so you can always tell who is who.' }),
        el('p', { text: 'Stuck? Hold the ball near their goal for three seconds and it goes in by itself.' }),
      close,
    ),
  );
  close.addEventListener('click', () => {
    sfxTap();
    overlay.hidden = true;
  });
  return overlay;
}
