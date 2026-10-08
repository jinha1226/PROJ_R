import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { startRaid } from '../../src/sim/base/raids';
import { swarmTick } from '../../src/sim/base/swarm';
import { raidField } from '../../src/sim/base/raidPath';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { idx } from '../../src/sim/grid/types';
import { ultBarHtml } from '../../src/ui/overworld/raidControl';
import { raidNote, raidResultHtml } from '../../src/ui/overworld/raidBar';

it.each([6, 7])('seed %i: no fodder freezes out in the field — the whole horde reaches the pod in time', (seed) => {
  const p = newSurface(seed); p.podHp = 1e9;
  for (const u of p.units) if (u.side === 'hero') { u.nextAt = 1e9; const e = entOf(p, u.id)!; e.hp = e.maxHp = 1e9; e.pos = { ...e.pos }; }
  startRaid(p);
  for (let k = 0; k < 2400; k++) { p.time += 0.1; swarmTick(p, 0.1, []); }
  const field = raidField(p);
  const far = p.units.filter((u) => u.swarm && entOf(p, u.id)!.alive && field[idx(p.s.map, entOf(p, u.id)!.pos)]! > 4);
  expect(far.map((u) => [u.sx, u.sy])).toEqual([]);
});

it('a raid’s bar has its own pause button (a phone has no Space)', () => {
  const p = newSurface(4);
  expect(ultBarHtml(p, null, 1)).toContain('data-pause');
});

it('a raid that ends clears its raiders away, and the clones’ queued ultimates with them', () => {
  const p = newSurface(42); startRaid(p); p.raidQueue = [];
  const u = unitOf(p, 'hero')!; u.ultQueued = true; u.ultCell = { x: 1, y: 1 };
  const group = p.raid!.group;
  for (const f of p.units.filter((x) => x.group === group)) entOf(p, f.id)!.alive = false;
  worldTick(p, 0.05);
  expect(p.raid).toBeNull();
  expect(p.units.some((x) => x.group === group)).toBe(false); expect(p.s.foes.some((e) => e.group === group)).toBe(false);
  expect(u.ultQueued).toBeFalsy(); expect(u.ultCell).toBeUndefined();
});

it('the result says how the raid was lost, counts only buildings it broke, and the note promises no lost materials', () => {
  const p = newSurface(42); startRaid(p); p.raidQueue = [];
  for (const h of p.units.filter((x) => x.side === 'hero')) entOf(p, h.id)!.alive = false;
  worldTick(p, 0.05);
  expect(raidResultHtml(p)).toContain('방어선 붕괴');
  expect(raidNote({ t: 0, type: 'dead', text: 'raidLost' }, p)).not.toContain('자원');
});
