import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput } from '../../src/sim/world/worldSim';
import { partyUnits } from '../../src/sim/world/party';
import { heroUnit } from '../../src/sim/world/worldState';
import { SLOT_OFFSETS, followTarget } from '../../src/sim/world/follow';
import type { Obstacle } from '../../src/sim/battle/types';
import { testRegion, crew } from './support/worldKit';

const SEC = 20;
const box = (x: number, y: number, hx: number, hy: number): Obstacle => ({ pos: { x, y }, radius: 0, kind: 'box', half: { x: hx, y: hy } });
const sim = (obstacles: Obstacle[] = [], n = 5) => WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }, obstacles), crew(n), [], null, 1);
const step = (s: WorldSim, ticks: number, move = { x: 0, y: 0 }) => { for (let i = 0; i < ticks; i++) s.step({ ...idleInput(), move }); };
const far = (s: WorldSim) => { const h = heroUnit(s.w).pos; return Math.max(...partyUnits(s.w).map((u) => Math.hypot(u.pos.x - h.x, u.pos.y - h.y))); };

describe('following the leader', () => {
  it('four followers settle into their slots behind the leader', () => {
    const s = sim();
    step(s, SEC * 2, { x: 1, y: 0 });
    step(s, SEC * 3);
    const h = heroUnit(s.w);
    const followers = partyUnits(s.w).filter((u) => u.id !== h.id);
    followers.forEach((u, k) => {
      const slot = SLOT_OFFSETS[k]!;
      const want = { x: h.pos.x + slot.x * Math.cos(h.facing) - slot.y * Math.sin(h.facing), y: h.pos.y + slot.x * Math.sin(h.facing) + slot.y * Math.cos(h.facing) };
      expect(Math.hypot(u.pos.x - want.x, u.pos.y - want.y)).toBeLessThan(2);
    });
  });

  it('squeezes through a 4 m door and comes out the other side', () => {
    const s = sim([box(10, -6, 0.4, 4), box(10, 6, 0.4, 4)]);
    step(s, SEC * 7, { x: 1, y: 0 });
    step(s, SEC * 13);
    expect(heroUnit(s.w).pos.x).toBeGreaterThan(15);
    for (const u of partyUnits(s.w)) expect(u.pos.x).toBeGreaterThan(10.5);
  });

  it('keeps up through a stand of trees', () => {
    const trees: Obstacle[] = [];
    // a dense checkerboard, far thicker than generated regions (about one tree per 100 m²)
    for (let x = 4; x < 40; x += 3) for (let y = -10; y <= 10; y += 3) if ((x + y) % 2 === 0) trees.push({ pos: { x, y: y + 0.5 }, radius: 0.6, kind: 'rock' });
    const s = sim(trees);
    let worst = 0;
    for (let t = 0; t < SEC * 30; t++) {
      s.step({ ...idleInput(), move: { x: 1, y: Math.sin(t / 60) * 0.6 } });
      if (t > SEC * 3) worst = Math.max(worst, far(s));
    }
    expect(worst).toBeLessThanOrEqual(8);
  });

  it('a member left far behind out of sight is quietly brought back; one in sight walks', () => {
    const s = sim([], 3);
    step(s, SEC);
    heroUnit(s.w).pos = { x: 40, y: 0 };
    step(s, 3);
    expect(far(s)).toBeLessThan(6);
    const t = sim([], 3);
    step(t, SEC);
    const before = partyUnits(t.w).map((u) => ({ ...u.pos }));
    heroUnit(t.w).pos = { x: 12, y: 0 };
    step(t, 1);
    partyUnits(t.w).slice(1).forEach((u, i) => expect(Math.hypot(u.pos.x - before[i + 1]!.x, u.pos.y - before[i + 1]!.y)).toBeLessThan(0.5));
  });

  it('is deterministic', () => {
    const run = () => { const s = sim([box(10, -6, 0.4, 4), box(10, 6, 0.4, 4)]); step(s, SEC * 10, { x: 1, y: 0.2 }); return JSON.stringify(partyUnits(s.w).map((u) => u.pos)); };
    expect(run()).toEqual(run());
  });
  it('at a wall the back slots fold in close to the leader instead of queueing far behind', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }, [box(-3.5, 0, 0.4, 8)]), crew(5), [], null, 1);
    heroUnit(s.w).facing = 0;
    step(s, SEC * 4);
    expect(far(s)).toBeLessThan(4);
  });
  it('while holding an extraction point the formation draws in tight around the leader', () => {
    const s = sim();
    s.w.hero.channel = { kind: 'extract', ticks: 0, total: 160, target: 'x0' };
    const h = heroUnit(s.w).pos;
    for (let k = 0; k < 4; k++) { const t = followTarget(s.w, k); expect(Math.hypot(t.x - h.x, t.y - h.y)).toBeLessThanOrEqual(2); }
  });
});
