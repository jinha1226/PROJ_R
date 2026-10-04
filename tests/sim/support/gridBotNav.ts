import { walkBlocked } from '../../../src/sim/grid/actions';
import { exploreTarget } from '../../../src/sim/grid/explore';
import { findPath } from '../../../src/sim/grid/path';
import { WEAPONS } from '../../../src/sim/grid/items';
import { dist, idx, same, type Cell, type GAction, type GridState } from '../../../src/sim/grid/types';
import type { GridBotMode } from './gridBot';

/** Route only across seen ground. Pistol-only never steps on a melee pickup or opens a weapon chest. */
export function navigate(s: GridState, mode: GridBotMode, bagSpace: boolean, crossTraps = false): GAction {
  const terrain = { ...s, foes: s.foes.filter(f => s.visible.has(idx(s.map, f.pos))), traps: crossTraps ? [] : s.traps };
  const forbidden = s.floorItems.filter(f => f.item.kind === 'weapon' && WEAPONS[f.item.group].melee && mode === 'pistol-only').map(f => f.pos);
  const barred = (p: Cell) => forbidden.some(c => same(c, p));
  const step = (to: Cell, descend = false): GAction | null => {
    if (barred(to) || (!descend && s.map.stairs && same(to, s.map.stairs))) return null;
    const path = findPath(s.map, s.hero.pos, to, p => !s.seen[idx(s.map, p)] || walkBlocked(terrain, p) || barred(p)
      || (!descend && !!s.map.stairs && same(s.map.stairs, p)));
    const next = path?.[0];
    if (!next || (!descend && s.map.stairs && same(next, s.map.stairs))) return null;
    return { kind: 'move', dir: { x: next.x - s.hero.pos.x, y: next.y - s.hero.pos.y }, plain: true };
  };
  const items = s.floorItems.filter(f => s.seen[idx(s.map, f.pos)] && !barred(f.pos)
    && (bagSpace || (f.item.kind !== 'weapon' && f.item.kind !== 'armor')));
  const targets = [...items.map(f => f.pos), ...(mode === 'decent' ? s.chests.filter(c => !c.opened && s.seen[idx(s.map, c.pos)]).map(c => c.pos) : [])]
    .sort((a, b) => dist(s.hero.pos, a) - dist(s.hero.pos, b));
  for (const p of targets) { const action = step(p); if (action) return action; }
  // Treat stairs and refused pickups as obstacles when choosing a frontier, too.
  const view = { ...terrain, barrels: [...s.barrels, ...forbidden, ...(s.map.stairs ? [s.map.stairs] : [])] };
  const frontier = exploreTarget(view);
  if (frontier) { const action = step(frontier); if (action) return action; }
  if (s.map.stairs && s.seen[idx(s.map, s.map.stairs)]) {
    const action = step(s.map.stairs, true);
    if (action) return action;
  }
  // Revisit enemies on explored ground, including a guardian left behind while looting.
  for (const f of s.foes.filter(f => f.alive && s.seen[idx(s.map, f.pos)])) {
    const action = step(f.pos);
    if (action) return action;
  }
  return crossTraps ? { kind: 'wait' } : navigate(s, mode, bagSpace, true);
}
