import type { Gear } from '../../sim/grid/gear';
import type { Equipment } from '../../sim/grid/items';
import type { GAction } from '../../sim/grid/types';
import { GROUP_NOTE, statLine } from './weaponInfo';
import { engraveChips } from './levelUp';

const ACTION = {
  weapon: '<button class="btn primary" data-do="equip" data-testid="grid-bag-equip">사용 중인 손에 들기 (1턴)</button>',
  armor: '<button class="btn primary" data-do="wear" data-testid="grid-bag-wear">입기 (1턴)</button>',
  rune: '<button class="btn primary" data-do="inscribe" data-testid="grid-bag-inscribe">손에 든 무기에 새기기 (1턴)</button>',
};
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The bag: what is in hand and worn, eight slots, and take-in-hand / wear / drop for the chosen one. */
export class GridBag {
  readonly el = document.createElement('div');
  private sel = -1;
  private key = '';

  constructor(private readonly gear: () => Gear, private readonly act: (a: GAction) => void, private readonly close: () => void) {
    this.el.className = 'gbag';
    this.el.dataset.testid = 'grid-bag-panel';
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-do]');
      if (!t) return;
      if (t.dataset.do === 'close') return this.close();
      if (t.dataset.i !== undefined) { this.sel = Number(t.dataset.i); this.render(); return; }
      const kind = t.dataset.do as 'equip' | 'wear' | 'drop' | 'inscribe';
      if (this.sel >= 0) { this.act({ kind, bag: this.sel }); this.sel = -1; }
      this.render();
    });
    this.render();
  }

  render(): void {
    const g = this.gear();
    const key = JSON.stringify([g, this.sel]);
    if (key === this.key) return;
    this.key = key;
    const cell = (e: Equipment | null | undefined, label: string) => `<div class="gbag-cur"><small>${label}</small><b>${e ? esc(e.name) : '없음'}</b>${e ? `<span>${statLine(e)}</span>` : ''}${e?.kind === 'weapon' ? engraveChips(e.engraves) : ''}</div>`;
    const slots = Array.from({ length: 8 }, (_, i) => {
      const e = g.bag[i];
      return `<button class="gbag-slot ${i === this.sel ? 'sel' : ''} ${e ? '' : 'empty'}" data-i="${i}" ${e ? '' : 'disabled'} data-testid="grid-bag-${i}">${e ? esc(e.name) : ''}</button>`;
    }).join('');
    const chosen = g.bag[this.sel];
    this.el.innerHTML = `<div class="gbag-panel">
      <header><h3>가방</h3><button class="btn" data-do="close" data-testid="grid-bag-close">닫기</button></header>
      <div class="gbag-row">${cell(g.hands[0], g.active === 0 ? '손 1 (사용 중)' : '손 1')}${cell(g.hands[1], g.active === 1 ? '손 2 (사용 중)' : '손 2')}${cell(g.armor, '갑옷')}</div>
      <div class="gbag-grid">${slots}</div>
      ${chosen ? `<div class="gbag-detail"><b>${esc(chosen.name)}</b> ${statLine(chosen)}${chosen.kind === 'weapon' ? ` · ${GROUP_NOTE[chosen.group]}${engraveChips(chosen.engraves)}` : ''}</div>
        <div class="gbag-actions">${ACTION[chosen.kind]}
        <button class="btn" data-do="drop">버리기</button></div>` : '<p class="muted">가방의 물건을 골라 손에 들거나 입으세요.</p>'}
    </div>`;
  }
}
