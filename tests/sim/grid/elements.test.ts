import { describe, it, expect } from 'vitest';
import { applyElement } from '../../../src/sim/grid/status';
import { makeWeapon } from '../../../src/sim/grid/items';
import type { GridSim } from '../../../src/sim/grid/gridSim';
import { OPEN, sim, sureHits } from './kit';

const W = { kind: 'wait' } as const;
const ev = (g: GridSim, a: Parameters<GridSim['act']>[0] = W) => g.act(a);
const has = (evs: { type: string; dst?: string; src?: string }[], type: string, who?: string) => evs.some((e) => e.type === type && (!who || e.dst === who || e.src === who));

describe('statuses', () => {
  it('burning deals 2 a turn for three turns, then stops', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 12, y: 12 }, awake: false }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'fire', f.pos, 0, null, 'hero');
    const hp = f.hp;
    for (let i = 0; i < 5; i++) ev(g);
    expect(hp - f.hp).toBe(6);
    expect(f.status?.burn ?? 0).toBe(0);
  });

  it('a frozen foe loses two turns', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }]);
    applyElement(g.s, 0, 'frost', g.s.foes[0]!.pos, 0, null, 'hero');
    expect(has(ev(g), 'bump', g.s.foes[0]!.id)).toBe(false);
    expect(has(ev(g), 'bump', g.s.foes[0]!.id)).toBe(false);
    let struck = false;
    for (let i = 0; i < 3 && !struck; i++) struck = ev(g).some((e) => e.type === 'bump' && e.src === g.s.foes[0]!.id);
    expect(struck).toBe(true);
  });

  it('a frozen hero still spends time: any action is a forced wait', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    applyElement(g.s, 0, 'frost', g.s.hero.pos, 0, null, 'f9');
    const t = g.s.time;
    ev(g, { kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.pos).toEqual({ x: 7, y: 7 });
    expect(g.s.time).toBeGreaterThan(t);
  });

  it('poison stacks its turns and ticks 1', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 12, y: 12 }, awake: false }]);
    const f = g.s.foes[0]!;
    applyElement(g.s, 0, 'poison', f.pos, 0, null, 'hero');
    applyElement(g.s, 0, 'poison', f.pos, 0, null, 'hero');
    expect(f.status?.poison).toBe(12);
  });

  it('lightning jumps to foes beside the target, not beyond', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }, { kind: 'brute', pos: { x: 9, y: 7 } }, { kind: 'brute', pos: { x: 11, y: 7 } }]);
    sureHits(g);
    const [a, b, c] = g.s.foes;
    applyElement(g.s, 0, 'shock', a!.pos, 0, [6, 6], 'hero');
    expect(a!.hp).toBe(a!.maxHp - 6);
    expect(b!.hp).toBe(b!.maxHp - 3);
    expect(c!.hp).toBe(c!.maxHp);
  });
});

describe('fire and poison on the ground', () => {
  it('a fire tile burns whoever walks in and dies out after four turns', () => {
    const g = sim(OPEN, { x: 6, y: 7 });
    applyElement(g.s, 0, 'fire', { x: 8, y: 7 }, 0, null, 'f9');
    expect(g.s.tiles.some((t) => t.kind === 'fire')).toBe(true);
    ev(g, { kind: 'move', dir: { x: 1, y: 0 } });
    ev(g, { kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.status?.burn).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) ev(g);
    expect(g.s.tiles.some((t) => t.kind === 'fire')).toBe(false);
  });

  it('a poison cloud poisons who stands in it', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    applyElement(g.s, 0, 'poison', { x: 7, y: 7 }, 1, null, 'f9');
    ev(g);
    expect(g.s.hero.status?.poison).toBeGreaterThan(0);
  });
});

describe('explosives', () => {
  it('a barrel blows up when shot: 3x3 damage, fire on the floor, the next barrel goes too, each once', () => {
    const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 6 }, awake: false }]);
    sureHits(g);
    g.s.barrels = [{ x: 8, y: 7 }, { x: 9, y: 8 }, { x: 10, y: 9 }];
    g.s.hero.gear.hands[0] = makeWeapon('bow', 1);
    const t = ev(g, { kind: 'shoot', at: { x: 8, y: 7 } });
    expect(t.filter((e) => e.type === 'explode')).toHaveLength(3);
    expect(g.s.barrels).toHaveLength(0);
    expect(g.s.foes[0]!.hp).toBeLessThan(g.s.foes[0]!.maxHp);
    expect(g.s.tiles.filter((x) => x.kind === 'fire').length).toBeGreaterThan(5);
  });

  it('barrels block the way', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    g.s.barrels = [{ x: 8, y: 7 }];
    sureHits(g);
    g.s.hero.hp = 999;
    ev(g, { kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.hero.pos).toEqual({ x: 7, y: 7 });
  });

  it('a bomb and the four flasks do their thing; out of range or behind a wall is refused', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    sureHits(g);
    const f = g.s.foes[0]!;
    f.hp = 999;
    // keep the target where it is so the blasts never reach the hero
    f.stun = 99;
    const belt = g.s.hero.gear.belt;
    Object.assign(belt, { bomb: 1, fireFlask: 1, frostFlask: 1, shockFlask: 1, poisonFlask: 1 });
    ev(g, { kind: 'use', item: 'bomb', at: f.pos });
    expect(f.hp).toBeLessThan(999);
    ev(g, { kind: 'use', item: 'fireFlask', at: f.pos });
    expect(f.status?.burn).toBeGreaterThan(0);
    // frost on a burning foe is a reaction now: steam, the burning stops
    expect(ev(g, { kind: 'use', item: 'frostFlask', at: f.pos }).some((e) => e.type === 'react' && e.text === 'steam')).toBe(true);
    expect(f.status?.burn).toBe(0);
    ev(g, { kind: 'use', item: 'poisonFlask', at: f.pos });
    expect(f.status?.poison).toBeGreaterThan(0);
    expect(belt.bomb + belt.fireFlask + belt.frostFlask + belt.poisonFlask).toBe(0);
    expect(ev(g, { kind: 'use', item: 'shockFlask', at: { x: 13, y: 7 } }).map((e) => e.type)).toEqual(['blocked']);
  });

  it('a hero killed by poison ends the run once', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    applyElement(g.s, 0, 'poison', g.s.hero.pos, 0, null, 'f9');
    g.s.hero.hp = 1;
    const all = [] as string[];
    for (let i = 0; i < 4; i++) all.push(...ev(g).map((e) => e.type));
    expect(g.s.outcome).toBe('dead');
    expect(all.filter((x) => x === 'dead')).toHaveLength(1);
  });

  it('a fire staff spell sets the area alight', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    g.s.hero.gear.hands[0] = makeWeapon('staff', 1, 'fire');
    ev(g, { kind: 'shoot', target: g.s.foes[0]!.id });
    expect(g.s.foes[0]!.status?.burn).toBeGreaterThan(0);
    expect(g.s.tiles.filter((x) => x.kind === 'fire').length).toBeGreaterThan(1);
  });
});

describe('throwing', () => {
  it('you cannot throw at your own feet', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    g.s.hero.gear.belt.bomb = 1;
    expect(g.act({ kind: 'use', item: 'bomb', at: { x: 7, y: 7 } }).map((e) => e.type)).toEqual(['blocked']);
  });
});
