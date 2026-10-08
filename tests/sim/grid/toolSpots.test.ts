import { expect, it } from 'vitest';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { distanceMap } from '../../../src/sim/grid/path';
import { idx, tileAt, walkable } from '../../../src/sim/grid/types';
import { refreshSight } from '../../../src/sim/grid/state';
import { sim, OPEN } from './kit';
it('keeps every original walkable cell reachable without tools over 50 seeds in every zone', () => {
  const counts = { seal: 0, chasm: 0, hidden: 0 };
  for (let seed = 1; seed <= 50; seed++) for (const floor of [1, 6, 11, 15]) {
    const m = generateMap(seed, floor), d = distanceMap(m, m.start);
    const optional = new Set((m.toolSpots ?? []).flatMap(s => {
      counts[s.kind]++; const cells: number[] = [];
      for (let y = s.room.y; y < s.room.y + s.room.h; y++) for (let x = s.room.x; x < s.room.x + s.room.w; x++) cells.push(idx(m, { x, y }));
      expect(s.n).toBeGreaterThanOrEqual(3); expect(s.n).toBeLessThanOrEqual(4);
      expect(d[idx(m, s.reward)]).toBe(-1);
      return cells;
    }));
    m.tiles.forEach((tile, i) => { if (walkable(tile) && !optional.has(i)) expect(d[i], `${seed}/${floor}/${i}`).toBeGreaterThanOrEqual(0); });
    if (m.stairs) expect(d[idx(m, m.stairs)]).toBeGreaterThanOrEqual(0);
    expect(new Set(m.toolSpots?.map(s => s.kind)).size).toBe(m.toolSpots?.length ?? 0);
  }
  for (const n of Object.values(counts)) expect(n).toBeGreaterThan(0);
}, 30_000);
it.each(['seal', 'chasm'] as const)('blocks %s without its tool without advancing time', kind => {
  const g = sim(OPEN, { x: 1, y: 1 }); g.s.map.tiles[idx(g.s.map, { x: 2, y: 1 })] = kind;
  expect(g.act({ kind: 'move', dir: { x: 1, y: 0 } })).toContainEqual(expect.objectContaining({ type: 'blocked', text: kind }));
  expect(g.s.hero.pos).toEqual({ x: 1, y: 1 }); expect(g.s.time).toBe(0);
});
it('cutter opens a seal into a door, then walks through it', () => {
  const g = sim(OPEN, { x: 1, y: 1 }); g.s.run.tools = ['cutter'];
  const pos = { x: 2, y: 1 }; g.s.map.tiles[idx(g.s.map, pos)] = 'seal';
  g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(tileAt(g.s.map, pos)).toBe('door');
  g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.hero.pos).toEqual(pos);
});
it('grapple crosses one cell in either direction, collects loot, and refuses unsafe landings', () => {
  const g = sim(OPEN, { x: 1, y: 1 }); g.s.run.tools = ['grapple'];
  g.s.map.tiles[idx(g.s.map, { x: 2, y: 1 })] = 'chasm';
  g.s.floorItems = [{ pos: { x: 3, y: 1 }, item: { kind: 'material', mat: 'scrap', n: 4 } }];
  g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.hero.pos).toEqual({ x: 3, y: 1 });
  expect(g.s.run.materials.scrap).toBe(4); expect(g.s.time).toBe(1);
  g.act({ kind: 'move', dir: { x: -1, y: 0 } }); expect(g.s.hero.pos).toEqual({ x: 1, y: 1 });
  g.s.barrels.push({ x: 3, y: 1 }); g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.hero.pos).toEqual({ x: 1, y: 1 });
});
it('reveals only visible hidden doors with a scanner', () => {
  const g = sim(OPEN, { x: 1, y: 1 }), pos = { x: 2, y: 1 };
  g.s.map.tiles[idx(g.s.map, pos)] = 'wall'; g.s.map.hidden = [pos];
  refreshSight(g.s); expect(tileAt(g.s.map, pos)).toBe('wall');
  g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(g.s.hero.pos).toEqual({ x: 1, y: 1 });
  g.s.run.tools = ['scanner']; refreshSight(g.s); expect(tileAt(g.s.map, pos)).toBe('door');
});
it('teleports cannot strand a hero inside a locked side room', async () => {
  const { farCell } = await import('../../../src/sim/grid/traps');
  const { newState } = await import('../../../src/sim/grid/state');
  const s = newState(generateMap(5), 5), reachable = distanceMap(s.map, s.map.start);
  s.rng.pick = cells => {
    s.map.tiles.forEach((tile, i) => {
      if (tile === 'floor' && reachable[i] === -1) expect(cells).not.toContainEqual({ x: i % s.map.w, y: Math.floor(i / s.map.w) });
    });
    return cells[0]!;
  };
  expect(farCell(s, s.hero.pos, 0)).not.toBeNull();
});
it('grapple refuses diagonal crossings, walls, closed chests, foes and roots', async () => {
  const { addBuff } = await import('../../../src/sim/grid/buffs');
  for (const obstacle of ['wall', 'chest', 'foe', 'root', 'diagonal']) {
    const g = sim(OPEN, { x: 1, y: 1 }); g.s.run.tools = ['grapple'];
    g.s.map.tiles[idx(g.s.map, { x: 2, y: 1 })] = 'chasm';
    if (obstacle === 'wall') g.s.map.tiles[idx(g.s.map, { x: 3, y: 1 })] = 'wall';
    if (obstacle === 'chest') g.s.chests.push({ pos: { x: 3, y: 1 }, opened: false });
    if (obstacle === 'foe') g.s.foes = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'minion', pos: { x: 3, y: 1 } }]).s.foes;
    if (obstacle === 'root') addBuff(g.s, g.s.hero, 'root', 2, 0);
    if (obstacle === 'diagonal') g.s.map.tiles[idx(g.s.map, { x: 2, y: 2 })] = 'chasm';
    g.act({ kind: 'move', dir: { x: 1, y: obstacle === 'diagonal' ? 1 : 0 } });
    expect(g.s.hero.pos).toEqual({ x: 1, y: 1 });
  }
});
