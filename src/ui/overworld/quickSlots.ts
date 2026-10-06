import { useItem } from '../../sim/delve/consumables';
import { CONSUMABLES, type ConsumableId } from '../../sim/delve/catalog';
import type { GEvent } from '../../sim/grid/types';
import { posOf, targetOf, unitOf } from '../../sim/party/partyCore';
import type { RoamParty } from '../../sim/roam/roam';
import { icon } from '../grid/icons';
import { CONSUMABLE_TEXT } from '../../sim/delve/consumableText';

/** each consumable as a small coloured line icon (the name stays in the tooltip) */
const ICON: Record<ConsumableId, [string, string]> = {
  potion: ['potion', '#ff6a6a'], rage: ['potion', '#ffb04a'], poisonJar: ['potion', '#8ad05a'], fireBomb: ['bomb', '#ff7a3a'], iceBomb: ['bomb', '#6ac4ff'],
  smoke: ['cloud', '#b0b8c0'], cleanse: ['scroll', '#e6ffb0'], boltWand: ['charge', '#ffe25a'],
};

/** consumables thrown at a foe: without one in reach they stay in the bag */
const THROWN = new Set<ConsumableId>(['fireBomb', 'iceBomb', 'poisonJar', 'boltWand']);

/** Uses a consumable from the pack for a clone: a thrown one at the foe it is going for (kept if none). */
export function useConsumable(p: RoamParty, heroId: string, itemId: string): GEvent[] {
  const u = unitOf(p, heroId), it = p.pack.find((x) => x.id === itemId);
  if (!u || !it || !('consumable' in it)) return [];
  const target = targetOf(p, u, p.time);
  if (THROWN.has(it.consumable) && !target) return [];
  return useItem(p, heroId, itemId, target ? posOf(p, target) : undefined);
}

/** The quick slots: one button per kind of consumable in the pack (with its count); a tap uses one for the chosen clone. */
export class QuickSlots {
  readonly el = document.createElement('div');
  private html = '';

  constructor(private readonly p: () => RoamParty, private readonly sel: () => string, private readonly live: (ev: GEvent[]) => void) {
    this.el.className = 'quick-slots';
    this.el.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-q]')?.dataset.q;
      if (id) this.live(useConsumable(this.p(), this.sel(), id));
    });
  }

  update(): void {
    const kinds = new Map<ConsumableId, { id: string; n: number }>();
    for (const it of this.p().pack) if ('consumable' in it) { const k = kinds.get(it.consumable); kinds.set(it.consumable, { id: k?.id ?? it.id, n: (k?.n ?? 0) + (it.charges ?? 1) }); }
    const html = [...kinds].map(([c, k]) => `<button type="button" data-q="${k.id}" title="${CONSUMABLES[c]} · ${CONSUMABLE_TEXT[c]}" style="color:${ICON[c][1]}">${icon(ICON[c][0])}<small>${k.n}</small></button>`).join('');
    if (html === this.html) return;
    this.html = html;
    this.el.innerHTML = html;
    this.el.hidden = !html;
  }
}
