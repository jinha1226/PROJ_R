import { describe, it, expect } from 'vitest';
import { makeWeapon } from '../../../src/sim/grid/items';
import { walkBlocked } from '../../../src/sim/grid/actions';
import { findPath } from '../../../src/sim/grid/path';
import { applyElement } from '../../../src/sim/grid/status';
import { beltSlots } from '../../../src/sim/grid/explosives';
import { OPEN, sim, sureHits } from './kit';

describe('final review fixes (2)', () => {
  it('tap-walking routes around barrels instead of bumping them', () => {
    const rows = ['#######', '#.....#', '#.....#', '#######'];
    const g = sim(rows, { x: 1, y: 1 });
    g.s.barrels = [{ x: 3, y: 1 }];
    expect(walkBlocked(g.s, { x: 3, y: 1 })).toBe(true);
    const path = findPath(g.s.map, g.s.hero.pos, { x: 5, y: 1 }, (c) => walkBlocked(g.s, c))!;
    expect(path.some((c) => c.x === 3 && c.y === 1)).toBe(false);
  });

  it('a staff spell at an adjacent foe never hits the caster', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('staff', 1, 'fire');
    const hp = g.s.hero.hp;
    const ev = g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(ev.some((e) => e.dst === 'hero' && e.src === 'hero')).toBe(false);
    expect(g.s.hero.status?.burn ?? 0).toBe(0);
    expect(g.s.hero.hp).toBeGreaterThanOrEqual(hp - 10);
  });

  it('a spear does not reach through a closed door, and a mace does not shove into one', () => {
    const rows = ['#########', '#.......#', '#...+...#', '#.......#', '#########'];
    const g = sim(rows, { x: 3, y: 2 }, [{ kind: 'brute', pos: { x: 5, y: 2 } }]);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('spear', 1);
    const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(ev.some((e) => e.type === 'hit' && e.src === 'hero')).toBe(false);
    const m = sim(rows, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 3, y: 2 } }]);
    sureHits(m);
    m.s.hero.gear.hands[0] = makeWeapon('mace', 1);
    m.s.foes[0]!.hp = 99;
    m.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(m.s.foes[0]!.pos).not.toEqual({ x: 4, y: 2 });
  });

  it('once the champion falls the run is won, even if the hero dies in the same moment', () => {
    const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'champion', pos: { x: 12, y: 12 } }, { kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    const champ = g.s.foes[0]!;
    champ.hp = 1;
    champ.status = { burn: 3, freeze: 0, poison: 0 };
    g.s.hero.hp = 1;
    g.act({ kind: 'wait' });
    expect(g.s.outcome).toBe('won');
  });

  it('explosions and elements wake the sleepers they hit', () => {
    const g = sim(OPEN, { x: 2, y: 2 }, [{ kind: 'brute', pos: { x: 10, y: 10 }, awake: false }]);
    applyElement(g.s, 0, 'fire', g.s.foes[0]!.pos, 0, [3, 3], 'hero');
    expect(g.s.foes[0]!.awake).toBe(true);
  });

  it('belt slots carry their fixed keys (2 bomb … 6 poison) and only list what you carry', () => {
    const slots = beltSlots({ potion: 1, bomb: 0, fireFlask: 1, frostFlask: 2, shockFlask: 0, poisonFlask: 1 });
    expect(slots).toEqual([{ item: 'fireFlask', key: 3, n: 1 }, { item: 'frostFlask', key: 4, n: 2 }, { item: 'poisonFlask', key: 6, n: 1 }]);
  });
});
