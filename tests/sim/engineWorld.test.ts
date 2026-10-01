import { describe, it, expect } from 'vitest';
import { Battle } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
import { pushOutOfObstacle, segmentBlocked, clampToBounds } from '../../src/sim/battle/geometry';
import type { BattleSetup, Obstacle } from '../../src/sim/battle/types';

const WIDE = { minX: -60, maxX: 60, minY: -45, maxY: 45 };
const base = (): BattleSetup => setupFromPresets(1, 'solo', 'tutorial');

describe('engine extensions for the region-wide sim', () => {
  it('units are clamped to custom bounds instead of the 24x14 arena', () => {
    const s = { ...base(), bounds: WIDE, mode: 'world' as const };
    s.allies = s.allies.map((u) => ({ ...u, spawn: { x: 30, y: 20 } }));
    const b = new Battle(s);
    b.step();
    expect(b.state.units.find((u) => u.team === 'ally')!.pos.x).toBeGreaterThan(20);
  });

  it('box obstacles push units out and block sight', () => {
    const box: Obstacle = { pos: { x: 0, y: 0 }, radius: 0, kind: 'box', half: { x: 2, y: 1 } };
    const p = pushOutOfObstacle({ x: 1.5, y: 0.2 }, 0.4, box);
    expect(Math.abs(p.y) >= 1.4 - 1e-9 || Math.abs(p.x) >= 2.4 - 1e-9).toBe(true);
    expect(pushOutOfObstacle({ x: 5, y: 5 }, 0.4, box)).toEqual({ x: 5, y: 5 });
    const b = new Battle({ ...base(), obstacles: [box] });
    expect(segmentBlocked(b.state, { x: -5, y: 0 }, { x: 5, y: 0 })).toBe(true);
    expect(segmentBlocked(b.state, { x: -5, y: 3 }, { x: 5, y: 3 })).toBe(false);
    expect(clampToBounds(WIDE, { x: 100, y: -100 }, 1)).toEqual({ x: 59, y: -44 });
  });

  it('a unit never ends a step inside a box', () => {
    const s = { ...base(), obstacles: [{ pos: { x: -3, y: 0 }, radius: 0, kind: 'box', half: { x: 1, y: 3 } } as Obstacle] };
    const b = new Battle(s);
    for (let i = 0; i < 200 && !b.outcome; i++) {
      b.step();
      for (const u of b.state.units) if (u.alive) expect(Math.abs(u.pos.x + 3) < 1 + 0.39 && Math.abs(u.pos.y) < 3 + 0.39).toBe(false);
    }
  });

  it('dormant units neither act, move, nor get targeted', () => {
    const b = new Battle(base());
    const foes = b.state.units.filter((u) => u.team === 'enemy');
    for (const f of foes) f.dormant = true;
    const before = foes.map((f) => ({ ...f.pos }));
    for (let i = 0; i < 60; i++) b.step();
    foes.forEach((f, i) => expect(f.pos).toEqual(before[i]));
    expect(foes.every((f) => f.hp === f.maxHp)).toBe(true);
    const hero = b.state.units.find((u) => u.team === 'ally')!;
    expect(hero.intent?.targetId).toBeUndefined();
  });

  it('a controlled unit gets no AI intent', () => {
    const s = base();
    s.allies = s.allies.map((u) => ({ ...u, controlled: true }));
    const b = new Battle(s);
    for (let i = 0; i < 40; i++) b.step();
    expect(b.state.units.find((u) => u.team === 'ally')!.intent).toBeNull();
  });

  it('world mode never ends the battle on its own', () => {
    const b = new Battle({ ...base(), enemies: [], mode: 'world', bounds: WIDE });
    for (let i = 0; i < 20 * 320; i++) b.step();
    expect(b.outcome).toBeNull();
    expect(b.state.berserkMult).toBe(1);
  });
});
