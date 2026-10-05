import { walkBlocked } from '../../../src/sim/grid/actions';
import { shotClear } from '../../../src/sim/grid/combat';
import { WEAPONS } from '../../../src/sim/grid/items';
import { gunCost } from '../../../src/sim/grid/kataTargets';
import { findPath } from '../../../src/sim/grid/path';
import { weaponRange } from '../../../src/sim/grid/weapons';
import { add, canStep, DIRS, dist, idx, same, tileAt, walkable, type Cell, type GridState } from '../../../src/sim/grid/types';

export const direction = (from: Cell, to: Cell): Cell => ({ x: to.x - from.x, y: to.y - from.y });
export const adjacentFoes = (s: GridState) => s.foes.filter(f => f.alive && dist(f.pos, s.hero.pos) === 1
  && canStep(s.map, s.hero.pos, direction(s.hero.pos, f.pos)));
export const awakeThreats = (s: GridState) => s.foes.filter(f => f.alive && f.awake
  && s.visible.has(idx(s.map, f.pos)));
export const visibleFoes = (s: GridState) => s.foes.filter(f => f.alive && s.visible.has(idx(s.map, f.pos)));
export const pistolIndex = (s: GridState) => s.hero.gear.hands.findIndex(w => w && !WEAPONS[w.group].melee);
export const bladeIndex = (s: GridState) => s.hero.gear.hands.findIndex(w => w && WEAPONS[w.group].melee);
export const pistol = (s: GridState) => s.hero.gear.hands[pistolIndex(s)] ?? null;
export const gunReady = (s: GridState): boolean => { const w = pistol(s); return !!w && s.hero.charge >= gunCost(s, w); };
export function dangerCells(s: GridState): Set<number> {
  // Include imminent marks first, then later marks too: don't walk into a pending cast.
  const marks = [...s.telegraphs].sort((a, b) => Number(b.at <= s.hero.nextAt + 1.5) - Number(a.at <= s.hero.nextAt + 1.5));
  return new Set(marks.flatMap(t => t.cells.map(c => idx(s.map, c))));
}
export const isChoke = (s: GridState, c: Cell): boolean => walkable(tileAt(s.map, c))
  && DIRS.slice(0, 4).filter(d => walkable(tileAt(s.map, add(c, d)))).length <= 2;
export function stepToward(s: GridState, to: Cell): Cell | null {
  const p = findPath(s.map, s.hero.pos, to, c => walkBlocked(s, c))
    ?? findPath(s.map, s.hero.pos, to, c => s.barrels.some(b => same(b, c)));
  return p?.[0] ? direction(s.hero.pos, p[0]) : null;
}
export const shotTargets = (s: GridState, from = s.hero.pos) => {
  const w = pistol(s);
  return w ? visibleFoes(s).filter(f => dist(from, f.pos) <= weaponRange(w, s.hero) && shotClear(s, from, f.pos)) : [];
};
export const safeSteps = (s: GridState) => {
  const danger = dangerCells(s);
  return DIRS.filter(d => canStep(s.map, s.hero.pos, d)).map(d => add(s.hero.pos, d))
    .filter(c => !walkBlocked(s, c) && tileAt(s.map, c) !== 'door' && !danger.has(idx(s.map, c))
      && !s.tiles.some(t => same(t.pos, c) && t.until > s.time && t.kind !== 'steam'));
};
