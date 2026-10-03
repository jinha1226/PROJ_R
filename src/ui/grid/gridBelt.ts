import type { BeltItem } from '../../sim/grid/items';
import type { GridState } from '../../sim/grid/types';
import { icon } from './icons';

export const THROWN: Exclude<BeltItem, 'potion'>[] = ['bomb', 'fireFlask', 'frostFlask', 'shockFlask', 'poisonFlask'];
export const ITEM_NAME: Record<BeltItem, string> = { potion: '물약', bomb: '폭탄', fireFlask: '화염병', frostFlask: '냉기병', shockFlask: '번개병', poisonFlask: '독병' };
const ITEM_ICON: Record<Exclude<BeltItem, 'potion'>, [string, string]> = {
  bomb: ['skull', '#c8c8c8'], fireFlask: ['potion', '#ff7a3a'], frostFlask: ['potion', '#6ac4ff'], shockFlask: ['potion', '#ffe25a'], poisonFlask: ['potion', '#8ad05a'],
};

/** Throwables in a row (only what you carry): tap one to aim it. */
export class GridBelt {
  readonly el = document.createElement('div');
  private key = '';

  constructor(private readonly onPick: (item: Exclude<BeltItem, 'potion'>) => void) {
    this.el.className = 'gbelt';
    this.el.addEventListener('pointerdown', (e) => {
      const it = (e.target as HTMLElement).closest<HTMLElement>('[data-item]')?.dataset.item as Exclude<BeltItem, 'potion'> | undefined;
      if (!it) return;
      e.stopPropagation();
      e.preventDefault();
      this.onPick(it);
    });
  }

  update(s: GridState, aiming: string | null): void {
    const b = s.hero.gear.belt;
    const key = JSON.stringify([THROWN.map((i) => b[i]), aiming]);
    if (key === this.key) return;
    this.key = key;
    this.el.innerHTML = THROWN.filter((i) => b[i] > 0).map((i, n) => `<button class="gbelt-b ${aiming === i ? 'on' : ''}" data-item="${i}" data-testid="grid-use-${i}" style="--c:${ITEM_ICON[i][1]}">
      ${icon(ITEM_ICON[i][0])}<small>${b[i]}</small><i>${n + 2}</i></button>`).join('');
  }
}
