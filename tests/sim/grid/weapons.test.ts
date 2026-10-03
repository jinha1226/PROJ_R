import { describe, it, expect } from 'vitest';
import { makeWeapon, type WeaponGroup } from '../../../src/sim/grid/items';
import { activeWeapon, addToBag } from '../../../src/sim/grid/gear';
import type { GridSim } from '../../../src/sim/grid/gridSim';
import { OPEN, sim, sureHits } from './kit';

const hold = (g: GridSim, group: WeaponGroup) => { g.s.hero.gear.hands[0] = makeWeapon(group, 1); g.s.hero.gear.active = 0; };
const types = (evs: { type: string }[]) => evs.map((e) => e.type);
const hits = (evs: { type: string; src?: string; dst?: string }[]) => evs.filter((e) => (e.type === 'hit' || e.type === 'miss') && e.src === 'hero').map((e) => e.dst);
describe('melee weapon groups', () => {
  it('a dagger is quick and hits a sleeping foe three times as hard', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 }, awake: false }]);
    hold(g, 'dagger');
    g.s.hero.gear.cls = 'hunter';
    sureHits(g);
    g.s.foes[0]!.hp = 99;
    const hit = g.act({ kind: 'move', dir: { x: 1, y: 0 } }).find((e) => e.type === 'hit' && e.src === 'hero')!;
    expect(hit.amount).toBe(9);
    const t = g.s.time;
    g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.time - t).toBeCloseTo(0.7);
  });

  it('an axe sweeps the foe in front and both diagonals beside it, not the one behind', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }, { kind: 'minion', pos: { x: 8, y: 6 } }, { kind: 'minion', pos: { x: 8, y: 8 } }, { kind: 'minion', pos: { x: 6, y: 7 } }]);
    hold(g, 'axe');
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(new Set(hits(ev))).toEqual(new Set([g.s.foes[0]!.id, g.s.foes[1]!.id, g.s.foes[2]!.id]));
  });

  it('a spear strikes two in a line and reaches over an empty cell, never through a wall', () => {
    const two = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }, { kind: 'brute', pos: { x: 9, y: 7 } }]);
    hold(two, 'spear');
    expect(new Set(hits(two.act({ kind: 'move', dir: { x: 1, y: 0 } })))).toEqual(new Set([two.s.foes[0]!.id, two.s.foes[1]!.id]));
    const reach = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    hold(reach, 'spear');
    const ev = reach.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(hits(ev)).toEqual([reach.s.foes[0]!.id]);
    expect(reach.s.hero.pos).toEqual({ x: 7, y: 7 });
    const rows = [...OPEN];
    rows[7] = '#.......#.....#';
    const wall = sim(rows, { x: 6, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    hold(wall, 'spear');
    wall.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(wall.s.hero.pos).toEqual({ x: 7, y: 7 });
  });

  it('a mace shoves the foe back, and slamming it into a wall hurts more and stuns it', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    hold(g, 'mace');
    sureHits(g);
    g.s.foes[0]!.hp = 99;
    const shove = g.act({ kind: 'move', dir: { x: 1, y: 0 } }).find((e) => e.type === 'push');
    expect(shove?.to).toEqual({ x: 9, y: 7 });
    const w = sim(OPEN, { x: 12, y: 7 }, [{ kind: 'brute', pos: { x: 13, y: 7 } }]);
    hold(w, 'mace');
    sureHits(w);
    w.s.foes[0]!.hp = 99;
    expect(types(w.act({ kind: 'move', dir: { x: 1, y: 0 } }))).toContain('stun');
    expect(w.s.foes[0]!.pos).toEqual({ x: 13, y: 7 });
    const next = w.act({ kind: 'swap' });
    expect(next.some((e) => e.src === w.s.foes[0]!.id && e.type === 'bump')).toBe(false);
  });
});

describe('ranged weapon groups', () => {
  it('no reloading: a bow shoots every turn, a crossbow hits harder but takes 1.6 turns, a hunter shoots a fifth faster', () => {
    for (const [group, cls, time] of [['bow', 'warrior', 1], ['crossbow', 'warrior', 1.6], ['crossbow', 'hunter', 1.28]] as const) {
      const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
      g.s.hero.gear.cls = cls;
      hold(g, group);
      g.s.hero.gear.arrows = 5;
      g.s.foes[0]!.hp = 999;
      g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
      const t = g.s.time;
      expect(types(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }))[0]).toBe('shoot');
      expect(g.s.time - t).toBeCloseTo(time);
      expect(g.s.hero.gear.arrows).toBe(3);
    }
  });

  it('no arrows, no shot', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    hold(g, 'bow');
    g.s.hero.gear.arrows = 0;
    expect(types(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }))).toEqual(['blocked']);
  });

  it('a thrown dagger lands near the target and is picked up again by walking over it', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    hold(g, 'throwing');
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(activeWeapon(g.s.hero.gear)?.stack).toBe(5);
    const item = g.s.floorItems.find((f) => f.item.kind === 'weapon' && f.item.group === 'throwing')!;
    expect(item).toBeTruthy();
    g.s.foes[0]!.alive = false;
    for (let i = 0; i < 6 && g.s.floorItems.length; i++) g.act({ kind: 'move', dir: { x: Math.sign(item.pos.x - g.s.hero.pos.x), y: Math.sign(item.pos.y - g.s.hero.pos.y) } });
    expect(activeWeapon(g.s.hero.gear)?.stack).toBe(6);
  });

  it('a staff spends a charge per spell and gets it back after eight turns (four for a mage)', () => {
    for (const [cls, turns] of [['warrior', 8], ['mage', 4]] as const) {
      const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
      g.s.hero.gear.cls = cls;
      hold(g, 'staff');
      g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
      expect(activeWeapon(g.s.hero.gear)?.charges).toBe(2);
      g.s.foes[0]!.alive = false;
      for (let i = 0; i < turns - 1; i++) g.act({ kind: 'wait' });
      expect(activeWeapon(g.s.hero.gear)?.charges).toBe(3);
    }
  });

  it('bumping with a ranged weapon in hand is a weak bash', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    hold(g, 'crossbow');
    g.s.rng = { next: () => 0.999, int: (_a: number, b: number) => b, chance: () => true, pick: <T>(arr: readonly T[]) => arr[0]!, shuffle: <T>(arr: T[]) => arr, getState: () => 0 };
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(ev.find((e) => e.type === 'hit' && e.src === 'hero')!.amount).toBe(4);
  });
});

describe('gear actions and armour', () => {
  it('swap costs half a turn, taking from the bag or putting armour on one turn, dropping half', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    const step = (a: Parameters<GridSim['act']>[0]) => { const t = g.s.time; g.act(a); return g.s.time - t; };
    expect(step({ kind: 'swap' })).toBeCloseTo(0.5);
    addToBag(g.s.hero.gear, makeWeapon('axe', 1));
    expect(step({ kind: 'equip', bag: 0 })).toBeCloseTo(1);
    addToBag(g.s.hero.gear, { kind: 'armor', tier: 2, name: '사슬 갑옷', reduce: 2 });
    expect(step({ kind: 'wear', bag: 1 })).toBeCloseTo(1);
    expect(step({ kind: 'drop', bag: 0 })).toBeCloseTo(0.5);
    expect(g.s.floorItems).toHaveLength(1);
  });

  it('armour takes off foe damage but never all of it', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 8, y: 7 } }]);
    g.s.hero.gear.armor = { kind: 'armor', tier: 3, name: '판금 갑옷', reduce: 3 };
    g.s.hero.hp = 999;
    const dmg: number[] = [];
    for (let i = 0; i < 30; i++) for (const e of g.act({ kind: 'wait' })) if (e.type === 'hit' && e.dst === 'hero') dmg.push(e.amount!);
    expect(dmg.length).toBeGreaterThan(0);
    expect(Math.max(...dmg)).toBeLessThanOrEqual(2);
    expect(Math.min(...dmg)).toBeGreaterThanOrEqual(1);
  });

  it('a full bag leaves a find on the floor', () => {
    const g = sim(OPEN, { x: 7, y: 7 });
    for (let i = 0; i < 8; i++) addToBag(g.s.hero.gear, makeWeapon('mace', 1));
    g.s.floorItems.push({ pos: { x: 8, y: 7 }, item: makeWeapon('axe', 2) });
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(types(ev)).toContain('full');
    expect(g.s.floorItems).toHaveLength(1);
  });
});

describe('weapon rack', () => {
  it('a new run lays one of every other weapon group around the start to try', async () => {
    const { GridSim } = await import('../../../src/sim/grid/gridSim');
    const g = GridSim.create(7);
    const rack = g.s.floorItems.filter((f) => f.item.kind === 'weapon');
    const groups = rack.map((f) => f.item.kind === 'weapon' && f.item.group);
    expect(new Set(groups)).toEqual(new Set(['dagger', 'axe', 'spear', 'mace', 'bow', 'throwing', 'staff']));
    for (const f of rack) expect(Math.max(Math.abs(f.pos.x - g.s.hero.pos.x), Math.abs(f.pos.y - g.s.hero.pos.y))).toBeLessThanOrEqual(3);
  });
});
