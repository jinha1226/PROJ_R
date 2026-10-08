import { expect, it } from 'vitest';
import { coverOf, hitChance, inCover, shotClear } from '../../../src/sim/grid/combat';
import { computeFov, losClear } from '../../../src/sim/grid/fov';
import { foeTurn } from '../../../src/sim/grid/ai';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { distanceMap } from '../../../src/sim/grid/path';
import { add, canStep, DIRS, idx, opaque, tileAt, walkable, type Tile } from '../../../src/sim/grid/types';
import { OPEN, handMap, sim } from './kit';

it.each([['floor', 'none', 0], ['cover', 'half', 0.2], ['wall', 'full', 0.4], ['pillar', 'full', 0.4], ['door', 'full', 0.4]] as const)(
  '%s provides %s cover with the matching hit penalty', (tile, level, penalty) => {
    const m = handMap(OPEN), from = { x: 3, y: 3 }, to = { x: 7, y: 7 };
    const open = hitChance(m, from, to, 0.95);
    m.tiles[idx(m, { x: 6, y: 7 })] = tile;
    expect(coverOf(m, from, to)).toBe(level); expect(inCover(m, from, to)).toBe(level !== 'none');
    expect(hitChance(m, from, to, 0.95)).toBeCloseTo(open - penalty);
    expect(hitChance(m, from, to, 0.95, 0.5)).toBeCloseTo(open - penalty / 2);
    expect(coverOf(m, { x: 6, y: 6 }, to)).toBe('none');
    expect(hitChance(m, { x: 6, y: 6 }, to, 0.95)).toBe(0.95);
  });
it('full cover wins over half and the same rules protect either side', () => {
  const m = handMap(OPEN), from = { x: 3, y: 3 }, to = { x: 7, y: 7 };
  m.tiles[idx(m, { x: 6, y: 7 })] = 'cover'; m.tiles[idx(m, { x: 7, y: 6 })] = 'pillar';
  expect(coverOf(m, from, to)).toBe('full'); expect(coverOf(m, to, from)).toBe('none');
  m.tiles[idx(m, { x: 4, y: 3 })] = 'cover'; expect(coverOf(m, to, from)).toBe('half');
});
it('low cover blocks walking, including corner cuts, but not sight or fire', () => {
  const g = sim(OPEN, { x: 3, y: 7 }), s = g.s;
  s.map.tiles[idx(s.map, { x: 4, y: 7 })] = 'cover';
  expect(walkable('cover')).toBe(false); expect(opaque('cover')).toBe(false);
  expect(canStep(s.map, s.hero.pos, { x: 1, y: 0 })).toBe(false);
  expect(canStep(s.map, s.hero.pos, { x: 1, y: 1 })).toBe(false);
  const to = { x: 6, y: 7 };
  expect(losClear(s.map, s.hero.pos, to)).toBe(true); expect(shotClear(s, s.hero.pos, to)).toBe(true);
  expect(computeFov(s.map, s.hero.pos, 8).has(idx(s.map, to))).toBe(true);
});
it('30 seeded maps place room cover without blocking existing access or protected cells', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const m = generateMap(seed, seed % 15 + 1);
    expect(generateMap(seed, seed % 15 + 1)).toEqual(m);
    const covers = m.tiles.flatMap((t, k) => t === 'cover' ? [{ x: k % m.w, y: Math.floor(k / m.w) }] : []);
    expect(covers.length).toBeGreaterThan(0);
    const before = distanceMap({ ...m, tiles: m.tiles.map(t => t === 'cover' ? 'floor' : t) }, m.start);
    const after = distanceMap(m, m.start);
    m.tiles.forEach((t, k) => { if (t === 'floor' && before[k]! >= 0) expect(after[k], `seed ${seed}, cell ${k}`).toBeGreaterThanOrEqual(0); });
    // Sealed tool rooms remain intentionally unreachable until their tool is used.
    const protectedCells = [m.start, ...m.exits, ...m.chests, ...(m.barrels ?? []), ...(m.stairs ? [m.stairs] : []),
      ...(m.traps ?? []).map(t => t.pos), ...m.spawns.map(f => f.pos), ...(m.toolSpots ?? []).flatMap(t => [t.pos, t.reward])];
    for (const c of protectedCells) expect(tileAt(m, c)).not.toBe('cover');
    for (const c of covers) expect(DIRS.some(d => ['door', 'open'].includes(tileAt(m, add(c, d))))).toBe(false);
    for (const [i, r] of m.rooms.entries()) {
      const cells: Tile[] = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push(tileAt(m, { x, y }));
      const count = cells.filter(t => t === 'cover').length, floor = cells.filter(t => t === 'floor' || t === 'cover').length;
      if (i === 0) expect(count).toBe(0);
      else { expect(count).toBeGreaterThanOrEqual(Math.ceil(floor * 0.04)); expect(count).toBeLessThanOrEqual(Math.min(6, Math.floor(floor * 0.1))); }
    }
  }
});
it.each(['archer', 'mage'] as const)('%s chooses covered shooting cells even with a clear current shot', kind => {
  const s = sim(OPEN, { x: 3, y: 7 }, [{ kind, pos: { x: 7, y: 7 } }]).s;
  // (6,6) covers the candidate (7,6); moving left remains a valid open shot.
  s.map.tiles[idx(s.map, { x: 6, y: 6 })] = 'cover';
  expect(coverOf(s.map, s.hero.pos, s.foes[0]!.pos)).toBe('none');
  foeTurn(s, s.foes[0]!);
  expect(coverOf(s.map, s.hero.pos, s.foes[0]!.pos)).toBe('half');
  expect(s.events.some(e => e.type === 'move')).toBe(true);
  expect(shotClear(s, s.foes[0]!.pos, s.hero.pos)).toBe(true);
});
