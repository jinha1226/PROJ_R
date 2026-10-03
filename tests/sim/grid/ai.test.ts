import { describe, it, expect } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { dist, type GAction } from '../../../src/sim/grid/types';
import { OPEN, sim } from './kit';

const W = { kind: 'wait' } as const;
const has = (evs: { type: string; src?: string }[], type: string, src?: string) => evs.some((e) => e.type === type && (!src || e.src === src));

/** Two rooms split by a wall with a door: west (hero) and east. */
const TWO = [
  '###############',
  '#.....#.......#',
  '#.....#.......#',
  '#.....+.......#',
  '#.....#.......#',
  '#.....#.......#',
  '###############',
];

describe('waking', () => {
  it('a sleeping foe out of sight stays put; one that sees the hero wakes its group', () => {
    const g = sim(TWO, { x: 2, y: 3 }, [{ kind: 'minion', pos: { x: 12, y: 3 }, awake: false }, { kind: 'minion', pos: { x: 12, y: 1 }, awake: false }]);
    g.s.foes[1]!.group = g.s.foes[0]!.group;
    for (let i = 0; i < 3; i++) g.act(W);
    expect(g.s.foes[0]!.pos).toEqual({ x: 12, y: 3 });
    expect(g.s.foes[0]!.awake).toBe(false);
    const open = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 }, awake: false }, { kind: 'minion', pos: { x: 12, y: 12 }, awake: false }]);
    open.s.foes[1]!.group = open.s.foes[0]!.group;
    // seen from afar a sleeper wakes within a few turns (not always at once), and rouses its group
    let woke = false;
    for (let i = 0; i < 12 && !woke; i++) woke = has(open.act(W), 'wake');
    expect(woke).toBe(true);
    expect(open.s.foes.every((f) => f.awake)).toBe(true);
  });

  it('a crossbow shot wakes sleepers within six tiles', () => {
    const closet = ['###############', '#.....#.......#', '#.....#.......#', '#.............#', '#######.......#', '#..#..#.......#', '###############'];
    const g = sim(closet, { x: 4, y: 3 }, [{ kind: 'minion', pos: { x: 1, y: 5 }, awake: false }, { kind: 'brute', pos: { x: 9, y: 3 }, awake: false }]);
    g.s.foes[0]!.group = 7;
    g.s.foes[1]!.group = 8;
    g.s.hero.gear.active = 1;
    g.act({ kind: 'shoot', target: g.s.foes[1]!.id });
    expect(g.s.foes[0]!.awake).toBe(true);
  });
});

describe('foe behaviour', () => {
  it('a minion chases and strikes the hero', () => {
    const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }]);
    let struck = false;
    for (let i = 0; i < 12 && !struck; i++) struck = has(g.act(W), 'bump', g.s.foes[0]!.id);
    expect(struck).toBe(true);
    expect(dist(g.s.foes[0]!.pos, g.s.hero.pos)).toBe(1);
  });

  it('an archer backs off when close, shoots from range, and moves to get a clear line', () => {
    const close = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'archer', pos: { x: 9, y: 7 } }]);
    close.act(W);
    expect(dist(close.s.foes[0]!.pos, close.s.hero.pos)).toBeGreaterThan(2);
    const far = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'archer', pos: { x: 8, y: 7 } }]);
    expect(has(far.act(W), 'shoot', far.s.foes[0]!.id)).toBe(true);
    const rows = [...OPEN];
    rows[7] = '#......P......#';
    const blocked = sim(rows, { x: 3, y: 7 }, [{ kind: 'archer', pos: { x: 10, y: 7 } }]);
    const ev = blocked.act(W);
    expect(has(ev, 'shoot', blocked.s.foes[0]!.id)).toBe(false);
    expect(has(ev, 'move', blocked.s.foes[0]!.id)).toBe(true);
  });
});

describe('the end of a run', () => {
  it('dying ends the run', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    g.s.hero.hp = 1;
    let ev: { type: string }[] = [];
    for (let i = 0; i < 30 && !g.s.outcome; i++) ev = g.act(W);
    expect(g.s.outcome).toBe('dead');
    expect(has(ev, 'dead')).toBe(true);
  });

  it('the same seed and the same actions give the same sortie', () => {
    const acts: GAction[] = Array.from({ length: 40 }, (_, i) => (i % 5 === 4 ? { kind: 'shoot' } : { kind: 'move', dir: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }][i % 4]! }));
    const run = () => { const g = GridSim.create(9); for (const a of acts) g.act(a); return JSON.stringify([g.s.hero, g.s.foes, g.s.time]); };
    expect(run()).toEqual(run());
  });
});
