import { describe, it, expect } from 'vitest';
import { noise } from '../../../src/sim/grid/danger';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { makeWeapon } from '../../../src/sim/grid/items';
import { walkBlocked } from '../../../src/sim/grid/actions';
import { buffOn } from '../../../src/sim/grid/buffs';
import type { TrapKind } from '../../../src/sim/grid/types';
import { dist, same } from '../../../src/sim/grid/types';
import { OPEN, sim, sureHits } from './kit';

const R = { x: 1, y: 0 };
const trapAt = (g: ReturnType<typeof sim>, x: number, y: number, kind: TrapKind, found = false) => { g.s.traps = [{ pos: { x, y }, kind, found }]; };

describe('noise', () => {
  it('a quiet noise wakes a sleeper beside it only sometimes, and never one two cells off', () => {
    let woke = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = sim(OPEN, { x: 3, y: 3 }, [{ kind: 'minion', pos: { x: 4, y: 3 }, awake: false }, { kind: 'minion', pos: { x: 5, y: 3 }, awake: false }], seed);
      noise(g.s, { x: 3, y: 3 }, 1);
      if (g.s.foes[0]!.awake) woke++;
      expect(g.s.foes[1]!.awake).toBe(false);
    }
    expect(woke).toBeGreaterThan(5);
    expect(woke).toBeLessThan(35);
  });

  it('a loud noise (a shot, a blast) always wakes everyone in its radius', () => {
    const g = sim(OPEN, { x: 3, y: 3 }, [{ kind: 'minion', pos: { x: 9, y: 3 }, awake: false }]);
    noise(g.s, { x: 3, y: 3 }, 6);
    expect(g.s.foes[0]!.awake).toBe(true);
  });

  it('a sleeper that can see the hero does not always wake at once; closer, it wakes more often', () => {
    const woke = (x: number) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'minion', pos: { x, y: 7 }, awake: false }], seed);
        g.act({ kind: 'wait' });
        if (g.s.foes[0]!.awake) n++;
      }
      return n;
    };
    const far = woke(8);
    const near = woke(3);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeLessThan(60);
    expect(near).toBeGreaterThan(far);
  });
});

describe('traps', () => {
  it('a spike trap hurts the one who steps on it, once', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    trapAt(g, 6, 7, 'spike');
    const hp = g.s.hero.hp;
    const ev = g.act({ kind: 'move', dir: R });
    expect(ev.some((e) => e.type === 'trap' && e.text === 'spike')).toBe(true);
    expect(g.s.hero.hp).toBeLessThan(hp);
    expect(g.s.traps).toHaveLength(0);
    const after = g.s.hero.hp;
    g.act({ kind: 'wait' });
    expect(g.s.hero.hp).toBe(after);
  });

  it('a foe shoved onto a hidden trap sets it off', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('mace', 1);
    g.s.hero.gear.active = 0;
    g.s.foes[0]!.hp = 99;
    trapAt(g, 7, 7, 'spike');
    g.act({ kind: 'move', dir: R });
    expect(g.s.traps).toHaveLength(0);
    expect(g.s.foes[0]!.hp).toBeLessThan(99 - 6);
  });

  it('alarm wakes the floor around; poison and fire fill the cells around; a net holds the hero', () => {
    const alarm = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 13, y: 13 }, awake: false }]);
    trapAt(alarm, 6, 7, 'alarm');
    alarm.act({ kind: 'move', dir: R });
    expect(alarm.s.foes[0]!.awake).toBe(true);
    for (const kind of ['poison', 'fire'] as const) {
      const g = sim(OPEN, { x: 5, y: 7 });
      trapAt(g, 6, 7, kind);
      g.act({ kind: 'move', dir: R });
      expect(g.s.tiles.some((x) => x.kind === kind && same(x.pos, { x: 7, y: 8 }))).toBe(true);
    }
    const net = sim(OPEN, { x: 5, y: 7 });
    trapAt(net, 6, 7, 'net');
    net.act({ kind: 'move', dir: R });
    expect(buffOn(net.s.hero, 'root', net.s.time)).toBe(true);
    const t = net.s.time;
    const ev = net.act({ kind: 'move', dir: R });
    expect(ev.some((e) => e.type === 'root')).toBe(true);
    expect(net.s.hero.pos).toEqual({ x: 6, y: 7 });
    expect(net.s.time - t).toBe(1);
  });

  it('a teleport trap sends the hero to a far free cell', () => {
    const g = sim(OPEN, { x: 2, y: 2 });
    trapAt(g, 3, 2, 'teleport');
    g.act({ kind: 'move', dir: R });
    expect(dist(g.s.hero.pos, { x: 3, y: 2 })).toBeGreaterThanOrEqual(8);
  });

  it('searching finds every trap within two cells; walking past finds adjacent ones only sometimes', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.traps = [{ pos: { x: 7, y: 7 }, kind: 'spike', found: false }, { pos: { x: 5, y: 9 }, kind: 'net', found: false }, { pos: { x: 9, y: 7 }, kind: 'fire', found: false }];
    const t = g.s.time;
    const ev = g.act({ kind: 'search' });
    expect(g.s.time - t).toBe(1);
    expect(g.s.traps.map((x) => x.found)).toEqual([true, true, false]);
    expect(ev.filter((e) => e.type === 'trapFound')).toHaveLength(2);
    let found = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = sim(OPEN, { x: 5, y: 7 }, [], seed);
      trapAt(w, 6, 8, 'spike');
      w.act({ kind: 'wait' });
      if (w.s.traps[0]!.found) found++;
    }
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(40);
  });

  it('tap-walking routes around a trap once it is found', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    trapAt(g, 6, 7, 'spike', true);
    expect(walkBlocked(g.s, { x: 6, y: 7 })).toBe(true);
    trapAt(g, 6, 7, 'spike', false);
    expect(walkBlocked(g.s, { x: 6, y: 7 })).toBe(false);
  });

  it('mapgen hides traps away from the start, stairs and chests, the same for the same seed', () => {
    for (const floor of [1, 2, 3]) {
      const m = generateMap(11, floor);
      expect(m.traps!.length).toBeGreaterThanOrEqual(3);
      for (const t of m.traps!) {
        expect(m.tiles[t.pos.y * m.w + t.pos.x]).toBe('floor');
        expect(dist(t.pos, m.start)).toBeGreaterThan(3);
        if (m.stairs) expect(same(t.pos, m.stairs)).toBe(false);
        expect(m.chests.some((c) => same(c, t.pos)) || m.spawns.some((sp) => same(sp.pos, t.pos)) || (m.barrels ?? []).some((b) => same(b, t.pos))).toBe(false);
        expect(t.found).toBe(false);
      }
      expect(generateMap(11, floor).traps).toEqual(m.traps);
    }
  });
});
