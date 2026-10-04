import { ENGRAVES, SUIT_SLOTS, type EngraveId } from '../../sim/grid/engraveCore';
import type { GAction } from '../../sim/grid/types';

const FIT: Record<string, string> = { melee: '근접', ranged: '사격', magic: '마법', any: '공용' };
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Choose a suit engraving, then explicitly choose a replacement if all slots are full. */
export class LevelUpPanel {
  readonly el = document.createElement('div');

  constructor(offer: EngraveId[], suit: EngraveId[], level: number, act: (a: GAction) => void) {
    this.el.className = 'glvl';
    this.el.dataset.testid = 'grid-levelup';
    let selected: number | null = null;
    const render = () => {
      this.el.innerHTML = `<div class="glvl-panel">
        <h3>${selected === null ? '각인 선택' : '어느 칸을 바꿀까요?'}</h3>
        <p class="muted">레벨 ${level} · 슈트 각인 ${suit.length}/${SUIT_SLOTS}</p>
        <div class="glvl-cards">${(selected === null ? offer : suit).map((id, i) => `<button class="glvl-card" data-i="${i}" data-testid="${selected === null ? 'grid-levelup' : 'grid-suit-slot'}-${i}">
          <small>${FIT[ENGRAVES[id].fits]}</small><b>${esc(ENGRAVES[id].name)}</b><span>${esc(ENGRAVES[id].note)}</span></button>`).join('')}</div>
        ${selected === null ? '<button class="btn" data-do="skip" data-testid="grid-levelup-skip">넘기기</button>' : '<button class="btn" data-do="cancel">취소</button>'}
      </div>`;
    };
    render();
    this.el.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-do]');
      if (!button) return;
      if (button.dataset.do === 'cancel') { selected = null; render(); return; }
      if (button.dataset.do === 'skip') { act({ kind: 'choose', i: null }); return; }
      const i = Number(button.dataset.i);
      if (selected !== null) act({ kind: 'choose', i: selected, slot: i });
      else if (suit.length < SUIT_SLOTS) act({ kind: 'choose', i });
      else { selected = i; render(); }
    });
  }
}
