import { xitem } from '../../data/extract';
import type { Stats, UniqueId } from '../../data/types';
import type { UnitSetup } from '../battle/types';
import { mercToUnitSetup } from '../roster/toSetup';
import type { Mercenary } from '../roster/types';
import { speedMult, type Loadout } from './loadout';

/** The hero's combat setup: class and level from the mercenary, gear from the extraction loadout. */
export function heroSetup(hero: Mercenary, l: Loadout): UnitSetup {
  const base = mercToUnitSetup({ ...hero, gear: {} }, 0, { col: 2, row: 1 });
  const stats: Stats = { ...base.stats };
  const items = Object.values(l.equipped).filter((id): id is string => !!id).map(xitem);
  for (const it of items) for (const [k, v] of Object.entries(it.stats ?? {}) as [keyof Stats, number][]) stats[k] += v;
  stats.maxHp = Math.round(stats.maxHp);
  stats.moveSpeed *= speedMult(l);
  const weapon = l.equipped.weapon ? xitem(l.equipped.weapon) : undefined;
  const head = l.equipped.head ? xitem(l.equipped.head) : undefined;
  const chest = l.equipped.chest ? xitem(l.equipped.chest) : undefined;
  const uniques = [...new Set([...(base.uniques ?? []), ...items.map((i) => i.unique).filter((u): u is UniqueId => !!u)])];
  return {
    ...base, team: 'ally', controlled: true, stats, uniques,
    gear: {
      weapon: weapon?.visual?.weapon ?? base.gear.weapon,
      offhand: weapon ? weapon.visual?.offhand : base.gear.offhand,
      helmet: !!head?.visual?.helmet,
      cape: !!chest?.visual?.cape || base.gear.cape,
    },
    gearTiers: { weapon: weapon?.tier, armor: chest?.tier ?? head?.tier },
  };
}
