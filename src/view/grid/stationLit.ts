import type { MetaState } from '../../sim/grid/meta';
import type { StationId } from '../../sim/grid/ship';
export function stationLit(m: MetaState, id: StationId): boolean {
  if (id === 'pod' || id === 'records' || id === 'hatch') return true;
  return m.repairs.includes(id === 'armory' ? 'workbench' : id);
}
