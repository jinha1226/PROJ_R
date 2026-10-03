import { describe, it, expect } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { FOE_TABLE, scaleFoe, spawnKind } from '../../../src/sim/grid/foes';
import { nextFloor, XP_STEPS } from '../../../src/sim/grid/run';
import { generateMap } from '../../../src/sim/grid/mapgen';
import { findPath } from '../../../src/sim/grid/path';
import { OPEN, sim, sureHits } from './kit';

const W = { kind: 'wait' } as const;

describe('floors', () => {
  it('floors 1–4 have reachable stairs; floor 5 has the champion and no stairs', () => {
    for (const seed of [3, 8, 21]) {
      for (const floor of [1, 2, 3, 4]) {
        const m = generateMap(seed, floor);
        expect(m.stairs, `seed ${seed} floor ${floor}`).toBeTruthy();
        expect(findPath(m, m.start, m.stairs!)).not.toBeNull();
      }
      const m3 = generateMap(seed, 5);
      expect(m3.stairs).toBeUndefined();
      expect(m3.spawns.filter((s) => s.kind === 'champion')).toHaveLength(1);
    }
  });

  it('taking the stairs keeps the hero and starts a fresh floor', () => {
    const g = GridSim.create(5, 'pistol');
    const s = g.s;
    s.hero.hp = 17;
    s.hero.level = 2;
    s.tiles.push({ pos: { x: 1, y: 1 }, kind: 'fire', until: 999 });
    const gun = s.hero.gear.hands[0];
    const oldMap = s.map;
    nextFloor(s);
    expect(s.run.floor).toBe(2);
    expect(s.map).not.toBe(oldMap);
    expect(s.hero.pos).toEqual(s.map.start);
    expect(s.hero.hp).toBe(17);
    expect(s.hero.level).toBe(2);
    expect(s.hero.gear.hands[0]).toBe(gun);
    expect(s.tiles).toEqual([]);
    expect(s.telegraphs).toEqual([]);
    expect(s.foes.every((f) => f.alive && !f.awake)).toBe(true);
    // only the new floor's scattered potions and scrolls lie about
    expect(s.floorItems.every((f) => f.item.kind === 'potion' || f.item.kind === 'scroll')).toBe(true);
  });

  it('stepping onto the stairs goes down', () => {
    const rows = [...OPEN];
    const g = sim(rows, { x: 6, y: 7 });
    g.s.map.stairs = { x: 7, y: 7 };
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(ev.some((e) => e.type === 'floor')).toBe(true);
    expect(g.s.run.floor).toBe(2);
  });

  it('picking up the final core wins the run', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, []);
    sureHits(g);
    g.s.run.floor = 15;
    g.s.floorItems.push({ pos: { x: 8, y: 7 }, item: { kind: 'core', name: '에너지원' } });
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(g.s.outcome).toBe('won');
    expect(ev.some((e) => e.type === 'victory')).toBe(true);
    expect(g.act(W)).toEqual([]);
  });
});

describe('new foes', () => {
  it('a mage marks the ground around the hero, and it goes off on the mage\'s next turn; stepping out avoids it', () => {
    const g = sim(OPEN, { x: 4, y: 7 }, [{ kind: 'mage', pos: { x: 9, y: 7 } }]);
    sureHits(g);
    const ev = g.act(W);
    expect(ev.some((e) => e.type === 'telegraph')).toBe(true);
    expect(g.s.telegraphs).toHaveLength(1);
    g.act({ kind: 'move', dir: { x: -1, y: 0 } });
    g.act({ kind: 'move', dir: { x: -1, y: 0 } });
    expect(g.s.hero.hp).toBe(g.s.hero.maxHp);
    const stay = sim(OPEN, { x: 4, y: 7 }, [{ kind: 'mage', pos: { x: 9, y: 7 } }]);
    sureHits(stay);
    for (let i = 0; i < 3; i++) stay.act(W);
    expect(stay.s.hero.hp).toBeLessThan(stay.s.hero.maxHp);
  });

  it('a ghoul is quick: about ten moves while the hero waits seven', () => {
    const g = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'ghoul', pos: { x: 13, y: 13 } }]);
    g.s.foes[0]!.lastSeen = { x: 13, y: 1 };
    let moves = 0;
    for (let i = 0; i < 7; i++) moves += g.act(W).filter((e) => e.src === g.s.foes[0]!.id && e.type === 'move').length;
    expect(moves).toBeGreaterThanOrEqual(9);
    expect(moves).toBeLessThanOrEqual(10);
  });

  it('the champion telegraphs a whirl every third turn and calls two minions once at half health', () => {
    const g = sim(OPEN, { x: 4, y: 7 }, [{ kind: 'champion', pos: { x: 10, y: 7 } }]);
    g.s.hero.hp = 999;
    let whirls = 0;
    for (let i = 0; i < 9; i++) whirls += g.act(W).filter((e) => e.type === 'telegraph').length;
    expect(whirls).toBeGreaterThanOrEqual(2);
    const champ = g.s.foes[0]!;
    champ.hp = Math.floor(champ.maxHp / 2);
    g.act(W);
    g.act(W);
    expect(g.s.foes.filter((f) => f.kind === 'minion')).toHaveLength(2);
    g.act(W);
    expect(g.s.foes.filter((f) => f.kind === 'minion')).toHaveLength(2);
  });

  it('spawn mix: ranged foes are about a fifth in the crypt, no mages on floor 1; deeper foes are tougher', () => {
    const rng = createRng(4);
    const f2 = Array.from({ length: 2000 }, () => spawnKind(rng, 6));
    const ranged = f2.filter((k) => k === 'archer' || k === 'mage').length / f2.length;
    expect(ranged).toBeGreaterThan(0.15);
    expect(ranged).toBeLessThan(0.25);
    expect(Array.from({ length: 500 }, () => spawnKind(rng, 1)).includes('mage')).toBe(false);
    expect(scaleFoe('minion', 3).hp).toBeGreaterThan(FOE_TABLE.minion.hp);
  });
});

describe('growth and the deep', () => {
  it('kills give experience and level-ups raise health', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    g.s.hero.xp = XP_STEPS[0]! - 1;
    g.s.foes[0]!.hp = 1;
    const max = g.s.hero.maxHp;
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(ev.some((e) => e.type === 'levelUp')).toBe(true);
    expect(g.s.hero.level).toBe(2);
    expect(g.s.hero.maxHp).toBe(max + 5);
    expect(g.s.run.kills).toBe(1);
  });

  it('every 150 turns on a floor a wanderer or two turns up out of sight', () => {
    const g = GridSim.create(6, 'pistol');
    g.s.hero.hp = 9999;
    g.s.hero.maxHp = 9999;
    const n = g.s.foes.length;
    for (let i = 0; i < 151; i++) g.act(W);
    expect(g.s.foes.length).toBeGreaterThan(n);
  });

  it('the same seed, starting gun and actions give the same run across a floor change', () => {
    const run = () => {
      const g = GridSim.create(9, 'pistol');
      for (let i = 0; i < 10; i++) g.act({ kind: 'move', dir: { x: 1, y: 0 } });
      nextFloor(g.s);
      for (let i = 0; i < 10; i++) g.act({ kind: 'move', dir: { x: 0, y: 1 } });
      return JSON.stringify([g.s.hero, g.s.foes, g.s.time, g.s.run]);
    };
    expect(run()).toEqual(run());
  });
});
