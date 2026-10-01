import { xitem } from '../../data/extract';
import { addItem } from '../extract/loadout';
import { rollContainer } from '../extract/loot';
import type { ContainerKind } from '../extract/regionTypes';
import { refreshHero } from './heroRefresh';
import { partyUnits } from './party';
import type { WorldState } from './types';
import { emitW } from './worldState';

export const AUTO_RADIUS = 1.5;
/** Search time by container (ticks): plain finds 1 s, supplies 1.5 s, relic chests and the vault 2 s. */
export const SEARCH_TICKS: Record<ContainerKind, number> = { crate: 20, bag: 20, herb: 20, supply: 30, relic: 40, vault: 40 };

/** Low-stakes things the party scoops up just by walking past: junk, small parts, common consumables. Never gear, relics or keys. */
export function isAutoPick(id: string): boolean {
  const d = xitem(id);
  return d.kind === 'junk' || (d.kind === 'part' && d.tier <= 1) || (d.kind === 'consumable' && d.tier <= 1);
}

/** Takes what fits; returns how many of each were taken. */
function scoop(w: WorldState, id: string, n: number): number {
  const r = addItem(w.hero.loadout, id, n);
  if (r.added) w.hero.loadout = r.loadout;
  return r.added;
}

/** Members passing within 1.5 m pick up cheap things from piles and gather herbs; a full pack simply stops it. */
export function updateAutoLoot(w: WorldState): void {
  const members = partyUnits(w).filter((u) => !u.downed);
  let took = false;
  for (const p of w.piles) {
    if (p.manual || !p.items.length || !members.some((u) => Math.hypot(u.pos.x - p.pos.x, u.pos.y - p.pos.y) <= AUTO_RADIUS)) continue;
    p.items = p.items.flatMap((s) => {
      if (!isAutoPick(s.id)) return [s];
      const got = scoop(w, s.id, s.n);
      if (got) { took = true; emitW(w, 'picked', { id: s.id, n: got }); }
      return got < s.n ? [{ id: s.id, n: s.n - got }] : [];
    });
  }
  for (const c of w.region.containers) {
    if (c.kind !== 'herb' || w.containers[c.id]?.opened || !members.some((u) => Math.hypot(u.pos.x - c.pos.x, u.pos.y - c.pos.y) <= AUTO_RADIUS)) continue;
    const items = rollContainer(c, w.seed, w.b.tick / (60 * 20)).flatMap((s) => {
      const got = scoop(w, s.id, s.n);
      if (got) { took = true; emitW(w, 'picked', { id: s.id, n: got }); }
      return got < s.n ? [{ id: s.id, n: s.n - got }] : [];
    });
    w.containers[c.id] = { opened: true, items };
  }
  w.piles = w.piles.filter((p) => p.items.length);
  if (took) refreshHero(w);
}
