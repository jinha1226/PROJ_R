import { bodyAt } from './combat';
import { pickUp, type ShotHooks } from './weapons';
import { onEnter } from './status';
import { add, COST, idx, same, tileAt, walkable, type Cell, type GridState } from './types';
/** undefined means an ordinary step; null is a blocked tool interaction. */
export function toolMove(s: GridState, t: number, dir: Cell, hooks: ShotHooks): number | null | undefined {
  const h = s.hero, to = add(h.pos, dir), tile = tileAt(s.map, to);
  if (tile !== 'seal' && tile !== 'chasm') return undefined;
  const straight = Math.abs(dir.x) + Math.abs(dir.y) === 1;
  if (straight && tile === 'seal' && s.run.tools.includes('cutter')) {
    s.map.tiles[idx(s.map, to)] = 'door';
    s.events.push({ t, type: 'door', src: h.id, to, text: '절단' });
    hooks.noise(to, 2); return COST.open;
  }
  const landing = add(to, dir);
  if (straight && tile === 'chasm' && s.run.tools.includes('grapple') && walkable(tileAt(s.map, landing))
    && tileAt(s.map, landing) !== 'door' && !bodyAt(s, landing)
    && !s.chests.some(ch => !ch.opened && same(ch.pos, landing)) && !s.barrels.some(b => same(b, landing))) {
    s.events.push({ t, type: 'move', src: h.id, from: { ...h.pos }, to: landing, text: '갈고리' });
    h.pos = landing; hooks.noise(landing, 1); pickUp(s, t); onEnter(s, h, t); return COST.move;
  }
  s.events.push({ t, type: 'blocked', src: h.id, to, text: tile }); return null;
}
