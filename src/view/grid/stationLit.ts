import type { MetaState } from '../../sim/grid/meta';
import type { StationId } from '../../sim/grid/ship';
export function stationLit(m: MetaState, id: StationId): boolean {
  const f = m.facilities;
  switch (id) {
    case 'armory': return m.rounds.length > 0;
    case 'suitlab': return f.suitSlots > 2 || f.chargePlus > 0;
    case 'nav': return f.navCrypt || f.navRuins;
    default: return true;
  }
}
