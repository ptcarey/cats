import { PALETTE, PATTERNS } from '../game/constants';
import { initAudio, sfxMeow, sfxTap } from '../game/audio';
import { KEEPER_INDEX, catLook, teamLooks } from '../game/team';
import { clear, el } from './dom';
import { attachPreview } from './preview';
import { randomName, randomTeam, saveTeam } from './storage';
import type { AppContext, Screen } from './context';
import type { Pattern, TeamProfile } from '../game/types';

/**
 * Colours belong to the whole team, not to individual cats, so both sides stay
 * telling-apart-able during a match. The player picks one pattern and up to
 * three colours, then names each cat.
 */
export function createBuilderScreen(app: AppContext): Screen {
  let team: TeamProfile = app.getTeam();
  let selectedSlot = 0;

  function commit(): void {
    app.setTeam(team);
    saveTeam(team);
  }

  // ---- header -------------------------------------------------------------

  const backBtn = el('button.btn.btn--ghost.btn--icon', { type: 'button', 'aria-label': 'Back' }, '‹') as HTMLButtonElement;
  backBtn.addEventListener('click', () => {
    sfxTap();
    app.go('title');
  });

  const diceBtn = el('button.btn.btn--ghost.btn--icon', { type: 'button', 'aria-label': 'Surprise me' }, '🎲') as HTMLButtonElement;
  diceBtn.addEventListener('click', () => {
    initAudio();
    sfxMeow(1.2);
    team = randomTeam();
    commit();
    renderAll();
  });

  const teamField = el('input.field', {
    type: 'text',
    maxlength: '18',
    placeholder: 'Team name',
    'aria-label': 'Team name',
  }) as HTMLInputElement;
  teamField.addEventListener('input', () => {
    team.name = teamField.value.slice(0, 18);
    commit();
  });
  teamField.addEventListener('blur', () => {
    if (!team.name.trim()) {
      team.name = 'My Team';
      teamField.value = team.name;
      commit();
    }
  });

  // ---- whole-team preview -------------------------------------------------

  const preview = el<HTMLCanvasElement>('canvas.preview');
  attachPreview(preview, () => teamLooks(team), 0.78);

  // ---- pattern ------------------------------------------------------------

  const patternRow = el('div.chips');
  const patternChips = new Map<Pattern, HTMLButtonElement>();
  for (const p of PATTERNS) {
    const chip = el('button.chip', { type: 'button', 'aria-pressed': 'false' }, p.label) as HTMLButtonElement;
    chip.addEventListener('click', () => {
      sfxTap();
      team.pattern = p.id;
      commit();
      syncPatterns();
    });
    patternChips.set(p.id, chip);
    patternRow.append(chip);
  }

  // ---- colour slots -------------------------------------------------------

  const SLOT_LABELS = ['Coat', 'Markings', 'Ears & paws'];
  const slotRow = el('div.slots');
  const slotButtons: { btn: HTMLButtonElement; dot: HTMLElement }[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = el('span.slot__dot');
    const btn = el('button.slot', { type: 'button', 'aria-pressed': 'false' }, dot, el('span', { text: SLOT_LABELS[i] })) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      sfxTap();
      selectedSlot = i;
      syncSlots();
      syncSwatches();
    });
    slotButtons.push({ btn, dot });
    slotRow.append(btn);
  }

  const swatchGrid = el('div.swatches');

  // ---- cat names ----------------------------------------------------------

  const nameRow = el('div.roster');
  const nameFields: HTMLInputElement[] = [];
  for (let i = 0; i < 3; i++) {
    const canvas = el<HTMLCanvasElement>('canvas');
    attachPreview(canvas, () => [catLook(team, i)], 0.9);

    const field = el('input.field.field--mini', {
      type: 'text',
      maxlength: '12',
      'aria-label': `Name for cat ${i + 1}`,
    }) as HTMLInputElement;
    field.addEventListener('input', () => {
      team.catNames[i] = field.value.slice(0, 12);
      commit();
    });
    field.addEventListener('blur', () => {
      if (!team.catNames[i].trim()) {
        team.catNames[i] = randomName();
        field.value = team.catNames[i];
        commit();
      }
    });
    nameFields.push(field);

    nameRow.append(
      el('div.namecard', {},
        canvas,
        field,
        el('small.namecard__role', { text: i === KEEPER_INDEX ? 'Keeper' : 'Striker' }),
      ),
    );
  }

  const doneBtn = el('button.btn.btn--primary', { type: 'button' }, 'Done') as HTMLButtonElement;
  doneBtn.addEventListener('click', () => {
    initAudio();
    sfxMeow();
    commit();
    app.go('title');
  });

  const editor = el('div.editor', {},
    preview,
    el('div.label', { text: 'Fur' }),
    patternRow,
    el('div.label', { text: 'Team colours (pick up to 3)' }),
    slotRow,
    swatchGrid,
    el('div.label', { text: 'Cat names' }),
    nameRow,
  );

  const root = el('section.screen.builder', { hidden: true },
    el('div.builder__head', {}, backBtn, el('h2', { text: 'My Team' }), diceBtn),
    teamField,
    editor,
    doneBtn,
  );

  // ---- sync helpers -------------------------------------------------------

  function syncPatterns(): void {
    for (const [id, chip] of patternChips) {
      chip.setAttribute('aria-pressed', String(id === team.pattern));
    }
  }

  function syncSlots(): void {
    slotButtons.forEach(({ btn, dot }, i) => {
      const hex = team.colors[i];
      btn.setAttribute('aria-pressed', String(i === selectedSlot));
      btn.classList.toggle('slot--empty', !hex);
      dot.style.background = hex ?? '';
      // A slot can only be filled once the one before it is set.
      const reachable = i === 0 || team.colors.length >= i;
      btn.disabled = !reachable;
      btn.style.opacity = reachable ? '1' : '0.4';
    });
  }

  function syncSwatches(): void {
    clear(swatchGrid);

    // Slots 2 and 3 are optional, so they get a way back to "no colour".
    if (selectedSlot > 0) {
      const none = el('button.swatch', {
        type: 'button',
        'aria-label': 'No colour',
        'aria-pressed': String(team.colors.length <= selectedSlot),
      }) as HTMLButtonElement;
      none.style.background = 'repeating-linear-gradient(45deg,#ffffff22 0 6px,#ffffff55 6px 12px)';
      none.addEventListener('click', () => {
        sfxTap();
        // Dropping a slot drops the ones after it, keeping the list contiguous.
        team.colors = team.colors.slice(0, selectedSlot);
        commit();
        syncSlots();
        syncSwatches();
      });
      swatchGrid.append(none);
    }

    for (const swatch of PALETTE) {
      const btn = el('button.swatch', {
        type: 'button',
        'aria-label': swatch.name,
        'aria-pressed': String(team.colors[selectedSlot] === swatch.hex),
      }) as HTMLButtonElement;
      btn.style.background = swatch.hex;
      btn.addEventListener('click', () => {
        sfxTap();
        const next = team.colors.slice(0, selectedSlot);
        next[selectedSlot] = swatch.hex;
        team.colors = next;
        commit();
        syncSlots();
        syncSwatches();
      });
      swatchGrid.append(btn);
    }
  }

  function renderAll(): void {
    teamField.value = team.name;
    nameFields.forEach((f, i) => {
      f.value = team.catNames[i];
    });
    syncPatterns();
    syncSlots();
    syncSwatches();
  }

  return {
    root,
    onShow(): void {
      team = app.getTeam();
      selectedSlot = 0;
      renderAll();
    },
    onHide(): void {
      commit();
    },
  };
}
