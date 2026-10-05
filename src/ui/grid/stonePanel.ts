import { effectiveMods, MODS } from '../../sim/grid/mods';
import { guardian, stoneItem, stoneMod } from '../../sim/grid/stones';
import type { GAction, GridState } from '../../sim/grid/types';
import { modLine } from './ship/workbenchTypes';

const SLOT: Record<string, string> = { barrel: '총열', mag: '탄창', sight: '조준기', grip: '손잡이', chest: '흉갑', arms: '팔', legs: '다리', back: '등 장치', heart: '핵' };
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A stone just picked up: socket it now (this run), open a portal with a guardian's core, or keep it to bank at the ship. */
export class StonePanel {
  readonly el = document.createElement('div');

  constructor(s: GridState, id: string, act: (a: GAction) => void) {
    this.el.className = 'glvl stone';
    this.el.dataset.testid = 'grid-stone';
    const mod = stoneMod(id);
    const g = guardian(id);
    const slot = mod?.slot ?? 'heart';
    const now = effectiveMods(s.hero.baseMods ?? {}, s.hero.sockets ?? {})[slot];
    const nowMod = MODS.find((m) => m.id === now);
    const breaks = s.hero.sockets?.[slot];
    this.el.innerHTML = `<div class="glvl-panel">
      <h3>${esc(stoneItem(id).name)}</h3>
      <p class="muted">${SLOT[slot]} · ${nowMod ? `지금 ${esc(nowMod.name)}` : '비어 있음'}</p>
      <div class="glvl-cards"><div class="glvl-card stone-card"><small>${SLOT[slot]}</small><b>${esc(mod?.name ?? '')}</b><span>${mod ? esc(modLine(mod)) : ''}</span></div></div>
      ${breaks ? `<p class="stone-warn">${esc(stoneItem(breaks).name)} 파괴</p>` : ''}
      <div class="stone-acts">
        <button class="btn primary" data-do="socket" data-testid="grid-stone-socket">끼우기</button>
        ${g ? `<button class="btn" data-do="portal" data-testid="grid-stone-portal">포탈 열기 · 귀환</button>` : ''}
        <button class="btn" data-do="keep" data-testid="grid-stone-keep">보관</button>
      </div></div>`;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-do]');
      if (!b) return;
      if (b.dataset.do === 'socket') act({ kind: 'socket', stone: id });
      else if (b.dataset.do === 'portal') act({ kind: 'portal', stone: id });
      else act({ kind: 'socket', stone: null });
    });
  }
}
