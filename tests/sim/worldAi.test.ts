import { describe, it, expect } from 'vitest';
import { createWorld, unit, heroUnit } from '../../src/sim/world/worldState';
import { updateActivation, MAX_ACTIVE } from '../../src/sim/world/activation';
import { alertGroup, updatePerception } from '../../src/sim/world/perception';
import { updatePatrol } from '../../src/sim/world/patrol';
import { moveUnits } from '../../src/sim/battle/movement';
import type { Obstacle } from '../../src/sim/battle/types';
import { testRegion, spawn, hero, kit } from './support/worldKit';

const tick = (w: ReturnType<typeof createWorld>, n = 1) => {
  for (let i = 0; i < n; i++) { updateActivation(w); updatePerception(w); updatePatrol(w); moveUnits(w.b); w.b.tick++; }
};

describe('world: activation, perception, patrols', () => {
  it('far enemies sleep and wake as the hero comes near', () => {
    const w = createWorld(testRegion([spawn('a', 40, 0)]), hero(), kit(), 1);
    updateActivation(w);
    expect(unit(w, 'a').dormant).toBe(true);
    heroUnit(w).pos = { x: 20, y: 0 };
    updateActivation(w);
    expect(unit(w, 'a').dormant).toBe(false);
  });

  it(`never keeps more than ${MAX_ACTIVE} enemies awake, nearest first`, () => {
    const spawns = Array.from({ length: 30 }, (_, i) => spawn(`s${i}`, 5 + (i % 6) * 2, -10 + Math.floor(i / 6) * 4, `g${i % 3}`));
    const w = createWorld(testRegion(spawns), hero(), kit(), 1);
    for (const g of Object.values(w.groups)) g.alerted = true;
    updateActivation(w);
    const awake = w.b.units.filter((u) => u.team === 'enemy' && !u.dormant);
    expect(awake.length).toBe(MAX_ACTIVE);
    const far = Math.max(...awake.map((u) => Math.hypot(u.pos.x, u.pos.y)));
    const sleepers = w.b.units.filter((u) => u.team === 'enemy' && u.dormant);
    expect(sleepers.every((u) => Math.hypot(u.pos.x, u.pos.y) >= far - 1e-9)).toBe(true);
  });

  it('spots the hero in front, not behind or through a wall; one sighting alerts the whole group', () => {
    const w = createWorld(testRegion([spawn('a', 6, 0), spawn('b', 9, 2)]), hero(), kit(), 1);
    unit(w, 'a').facing = 0; // looking away (+x)
    tick(w);
    expect(w.groups.g1!.alerted).toBe(false);
    unit(w, 'a').facing = Math.PI; // looking at the hero
    tick(w);
    expect(w.groups.g1!.alerted).toBe(true);
    expect(unit(w, 'b').setup.controlled).toBeFalsy();

    const wall: Obstacle = { pos: { x: 3, y: 0 }, radius: 0, kind: 'box', half: { x: 0.4, y: 4 } };
    const w2 = createWorld(testRegion([spawn('a', 6, 0)], {}, [wall]), hero(), kit(), 1);
    unit(w2, 'a').facing = Math.PI;
    tick(w2);
    expect(w2.groups.g1!.alerted).toBe(false);
  });

  it('a hidden hero is not spotted even up close', () => {
    const w = createWorld(testRegion([spawn('a', 2, 0)]), hero(), kit(), 1);
    w.hero.hiddenUntil = 100;
    unit(w, 'a').facing = Math.PI;
    tick(w);
    expect(w.groups.g1!.alerted).toBe(false);
  });

  it('chasers give up past their leash, walk home, and heal', () => {
    const w = createWorld(testRegion([spawn('a', 10, 0)]), hero(), kit(), 1);
    alertGroup(w, 'g1');
    tick(w);
    const a = unit(w, 'a');
    a.pos = { x: 35, y: 0 };
    a.hp = a.maxHp / 2;
    heroUnit(w).pos = { x: 0, y: 20 };
    tick(w);
    expect(w.ai.a!.mode).toBe('return');
    expect(w.groups.g1!.alerted).toBe(false);
    tick(w, 20 * 15);
    expect(Math.hypot(a.pos.x - 10, a.pos.y)).toBeLessThan(1.5);
    expect(a.hp).toBe(a.maxHp);
    expect(w.ai.a!.mode).toBe('idle');
  });

  it('patrols walk their loop', () => {
    const route = [{ x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const w = createWorld(testRegion([spawn('p', 10, 0, 'pt', 'skeleton_minion', route)]), hero(), kit(), 1);
    heroUnit(w).pos = { x: 5, y: -12 }; // close enough to keep it awake, outside its sight
    const seen = new Set<number>();
    for (let i = 0; i < 20 * 40; i++) { tick(w); seen.add(w.ai.p!.wp); }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});
