import { describe, it, expect } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { shotClear } from '../../../src/sim/grid/combat';
import { archerCanShoot } from '../../../src/sim/grid/ai';
import { tileAt, walkable, type Cell } from '../../../src/sim/grid/types';
import { OPEN, sim } from './kit';

describe('final review fixes', () => {
  it('an opened chest can be walked over, so a chest in a doorway never seals the way', () => {
    const rows = [...OPEN];
    rows[7] = '#.....C.......#';
    const g = sim(rows, { x: 5, y: 7 });
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.chests[0]!.opened).toBe(true);
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.pos).toEqual({ x: 6, y: 7 });
  });

  it('no chest is placed right beside a door', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = generateMap(seed);
      for (const c of m.chests) for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }])
        expect(tileAt(m, { x: c.x + d.x, y: c.y + d.y }), `seed ${seed}`).not.toBe('door');
    }
  });

  it('a shot line is the same in both directions', () => {
    const g = GridSim.create(1);
    const s = g.s;
    s.foes = [];
    const floor: Cell[] = [];
    for (let y = 0; y < s.map.h; y += 2) for (let x = 0; x < s.map.w; x += 2) if (walkable(tileAt(s.map, { x, y }))) floor.push({ x, y });
    for (const a of floor.slice(0, 120)) for (const b of floor) {
      if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 7) continue;
      s.hero.pos = { x: -5, y: -5 };
      expect(shotClear(s, a, b), `${a.x},${a.y} → ${b.x},${b.y}`).toBe(shotClear(s, b, a));
    }
  });

  it('an archer the hero cannot see does not shoot (no shots from the dark)', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'archer', pos: { x: 9, y: 7 } }]);
    expect(archerCanShoot(g.s, g.s.foes[0]!)).toBe(false);
    const ev = g.act({ kind: 'wait' });
    expect(ev.some((e) => e.type === 'shoot' && e.src === g.s.foes[0]!.id)).toBe(false);
  });

  it('a foe walking through a closed door opens it', () => {
    const rows = ['#########', '#...#...#', '#...+...#', '#...#...#', '#########'];
    const g = sim(rows, { x: 1, y: 2 }, [{ kind: 'minion', pos: { x: 6, y: 2 } }]);
    g.s.foes[0]!.lastSeen = { x: 1, y: 2 };
    let opened = false;
    for (let i = 0; i < 4 && !opened; i++) opened = g.act({ kind: 'wait' }).some((e) => e.type === 'door' && e.src === g.s.foes[0]!.id);
    expect(opened).toBe(true);
    expect(g.s.map.tiles[2 * 9 + 4]).toBe('open');
  });
});
