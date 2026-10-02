import { GridSim } from '../../../src/sim/grid/gridSim';
import { newState } from '../../../src/sim/grid/state';
import type { Cell, FoeKind, GridMap, Tile } from '../../../src/sim/grid/types';

/** A hand map from rows: '#' wall, '.' floor, 'P' pillar, '+' door, 'C' chest (floor), 'X' exit (floor). */
export function handMap(rows: string[]): GridMap {
  const ch: Record<string, Tile> = { '#': 'wall', '.': 'floor', P: 'pillar', '+': 'door', C: 'floor', X: 'floor' };
  const m: GridMap = { w: rows[0]!.length, h: rows.length, tiles: [], rooms: [], start: { x: 1, y: 1 }, exits: [], chests: [], spawns: [] };
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    m.tiles.push(ch[c]!);
    if (c === 'C') m.chests.push({ x, y });
    if (c === 'X') m.exits.push({ x, y });
  }));
  return m;
}

export const OPEN = [
  '###############',
  ...Array.from({ length: 13 }, () => '#.............#'),
  '###############',
];

/** A sim on a hand map: hero at `hero`, the listed foes (awake unless said otherwise). */
export function sim(rows: string[], hero: Cell, foes: { kind: FoeKind; pos: Cell; awake?: boolean }[] = [], seed = 3): GridSim {
  const m = handMap(rows);
  m.start = hero;
  m.spawns = foes.map((f, i) => ({ kind: f.kind, pos: f.pos, group: i + 1 }));
  const s = newState(m, seed);
  s.foes.forEach((f, i) => { f.awake = foes[i]!.awake ?? true; });
  return GridSim.fromState(s);
}
