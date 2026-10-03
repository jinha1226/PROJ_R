import { describe, it, expect } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { hitChance } from '../../../src/sim/grid/combat';
import { OPEN, handMap, sim } from './kit';

const types = (evs: { type: string }[]) => evs.map((e) => e.type);

describe('hero actions', () => {
  it('a step onto floor costs a turn; a step into a wall costs nothing', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.pos).toEqual({ x: 8, y: 7 });
    expect(g.s.time).toBe(1);
    expect(types(ev)).toContain('move');
    const w = sim(OPEN, { x: 1, y: 1 });
    expect(types(w.act({ kind: 'move', dir: { x: -1, y: 0 } }))).toEqual(['blocked']);
    expect(w.s.time).toBe(0);
  });

  it('will not cut a wall corner diagonally', () => {
    const g = sim(['#####', '#..##', '#...#', '#####'], { x: 2, y: 2 });
    expect(types(g.act({ kind: 'move', dir: { x: 1, y: -1 } }))).toEqual(['blocked']);
  });

  it('moving into a foe attacks it instead (bump)', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    const hp = g.s.foes[0]!.hp;
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(types(ev)[0]).toBe('bump');
    expect(types(ev).some((t) => t === 'hit' || t === 'miss')).toBe(true);
    expect(g.s.hero.pos).toEqual({ x: 7, y: 7 });
    if (types(ev).includes('hit')) expect(g.s.foes[0]!.hp).toBeLessThan(hp);
  });

  it('the pistol fires again without reloading and spends one charge each time', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    g.s.foes[0]!.hp = 999;
    const id = g.s.foes[0]!.id;
    const charge = g.s.hero.charge;
    expect(types(g.act({ kind: 'shoot', target: id }))[0]).toBe('shoot');
    expect(types(g.act({ kind: 'shoot', target: id }))[0]).toBe('shoot');
    expect(g.s.hero.charge).toBe(charge - 2);
  });

  it('hit chance falls with distance and behind cover, never below 5%', () => {
    const m = handMap(OPEN);
    expect(hitChance(m, { x: 3, y: 7 }, { x: 4, y: 7 }, 0.85)).toBeCloseTo(0.85);
    expect(hitChance(m, { x: 3, y: 7 }, { x: 9, y: 7 }, 0.85)).toBeCloseTo(0.65);
    const cover = handMap(['#########', '#.......#', '#.....#.#', '#.......#', '#########']);
    expect(hitChance(cover, { x: 1, y: 2 }, { x: 7, y: 2 }, 0.85)).toBeCloseTo(0.85 - 0.04 * 5 - 0.3);
    expect(hitChance(cover, { x: 1, y: 2 }, { x: 7, y: 2 }, 0.1)).toBeCloseTo(0.05);
  });

  it('cannot shoot through a pillar', () => {
    const rows = [...OPEN];
    rows[7] = '#.....P.......#';
    const g = sim(rows, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    expect(types(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }))).toEqual(['blocked']);
  });

  it('a potion heals 12, never past full', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    const n = g.s.hero.gear.belt.potion;
    g.s.hero.hp = 10;
    g.act({ kind: 'use', item: 'potion' });
    expect(g.s.hero.hp).toBe(22);
    expect(g.s.hero.gear.belt.potion).toBe(n - 1);
    g.s.hero.hp = g.s.hero.maxHp - 1;
    g.act({ kind: 'use', item: 'potion' });
    expect(g.s.hero.hp).toBe(g.s.hero.maxHp);
  });

  it('doors open when entered and chests open when bumped', () => {
    const rows = [...OPEN];
    rows[7] = '#.....+C......#';
    const g = sim(rows, { x: 5, y: 7 });
    expect(types(g.act({ kind: 'move', dir: { x: 1, y: 0 } }))).toContain('door');
    expect(g.s.map.tiles[7 * 15 + 6]).toBe('open');
    const before = g.s.hero.charge;
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(types(ev)).toContain('open');
    expect(g.s.hero.pos).toEqual({ x: 6, y: 7 });
    expect(g.s.chests[0]!.opened).toBe(true);
    expect(g.s.hero.charge).toBe(before);
    expect(types(ev)).toContain('loot');
  });
});

describe('turn order', () => {
  it('a slow brute acts about five times while the hero waits seven', () => {
    const g = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'brute', pos: { x: 13, y: 13 } }]);
    let acts = 0;
    for (let i = 0; i < 7; i++) acts += g.act({ kind: 'wait' }).filter((e) => e.src === g.s.foes[0]!.id).length;
    expect(acts).toBe(5);
  });

  it('the hero goes first on a tie, foes on equal time go in id order', () => {
    const g = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'minion', pos: { x: 13, y: 13 } }, { kind: 'minion', pos: { x: 13, y: 11 } }]);
    const ev = g.act({ kind: 'wait' });
    const foeEv = ev.filter((e) => e.src && e.src !== 'hero');
    expect(foeEv.map((e) => e.src)).toEqual([g.s.foes[0]!.id, g.s.foes[1]!.id]);
    expect(ev[0]!.src).toBe('hero');
  });

  it('a killed foe leaves the order; auto-target picks the nearest visible foe and keeps it', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'minion', pos: { x: 9, y: 7 }, awake: false }, { kind: 'minion', pos: { x: 6, y: 7 }, awake: false }]);
    expect(g.autoTarget()).toBe(g.s.foes[1]!.id);
    g.s.hero.target = g.s.foes[0]!.id;
    expect(g.autoTarget()).toBe(g.s.foes[1]!.id);
    g.s.foes[1]!.hp = 1;
    g.s.hero.target = undefined;
    const r = GridSim.fromState(g.s);
    for (let i = 0; i < 20 && r.s.foes[1]!.alive; i++) r.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(r.s.foes[1]!.alive).toBe(false);
  });
});
