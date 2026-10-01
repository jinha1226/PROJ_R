import type { Vec2 } from '../../core/vec2';
import type { MemberEnd, SortieEnd } from '../extract/companyTypes';
import type { Stack } from '../extract/inventory';
import { emptyLoadout } from '../extract/loadout';
import { extractZone, inZone } from './extraction';
import { refreshHero } from './heroRefresh';
import { dropAt } from './interact';
import { partyUnits } from './party';
import type { WorldState } from './types';
import { emitW } from './worldState';

const WITNESS_RANGE = 12;

/** A member died: their gear stays on the body (searchable), their share of the pack is gone (overflow spills). */
export function memberDied(w: WorldState, id: string, pos: Vec2): void {
  if (w.party.dead.includes(id)) return;
  w.party.dead.push(id);
  const gear = w.party.gear[id]!;
  const worn: Stack[] = Object.values(gear.equipped).filter((x): x is string => !!x).map((x) => ({ id: x, n: 1 }));
  dropAt(w, pos, worn);
  w.party.gear[id] = { ...emptyLoadout(), equipped: {} };
  w.party.lost = { ...(w.party.lost ?? {}), [id]: gear };
  refreshHero(w);
  const witnesses = partyUnits(w).filter((u) => Math.hypot(u.pos.x - pos.x, u.pos.y - pos.y) <= WITNESS_RANGE).map((u) => u.id);
  emitW(w, 'member_died', { id, witnesses });
}

/** What the sortie hands back to the company: who came home, who was carried out, who was lost, and the loot. */
export function sortieEnd(w: WorldState): SortieEnd {
  const ok = w.outcome === 'extracted';
  const zone = extractZone(w);
  const members: MemberEnd[] = w.party.order.map((id) => {
    const u = w.b.units.find((x) => x.id === id);
    const gear = w.party.lost?.[id] ?? w.party.gear[id]!;
    if (!ok || !u?.alive) return { id, state: 'dead', xp: 0, gear };
    const inside = w.party.exitVia === 'recall' || (!!zone && inZone(zone, u.pos));
    if (!inside) return { id, state: 'dead', xp: 0, gear };
    return { id, state: u.downed ? 'carried' : 'home', xp: w.xp, gear };
  });
  const quick = w.hero.loadout.quick.filter((q): q is Stack => !!q);
  return { outcome: ok ? 'extracted' : 'failed', pack: ok ? [...w.hero.loadout.bag, ...quick] : [], pouch: w.hero.loadout.pouch, members };
}
