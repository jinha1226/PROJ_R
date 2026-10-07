import { DIRS, tileAt, walkable, type Cell } from '../../../src/sim/grid/types';
import { entOf, occupied, type Party } from '../../../src/sim/party/partyCore';

/** A free floor cell beside a unit (where an aimed ultimate such as earth slam can land). */
export const freeBeside = (p: Party, id: string): Cell => {
  const at = entOf(p, id)!.pos;
  return DIRS.map((d) => ({ x: at.x + d.x, y: at.y + d.y })).find((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, id))!;
};
