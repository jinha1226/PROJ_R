import { expect, it } from 'vitest';
import { entOf } from '../../src/sim/party/partyCore';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { canPrintClone, printClone } from '../../src/sim/base/cloner';
import { clones, implantCarried } from '../../src/sim/roam/roam';
import { cloneCap, footprint, moduleOf } from '../../src/sim/base/modules';
import { dist, idx } from '../../src/sim/grid/types';

const calm = (p: ReturnType<typeof newSurface>) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; };

it('the pod lands with its lab beside it: the clone printer\'s module, four cells in the way', () => {
  const p = newSurface(4), lab = moduleOf(p, 'lab')!;
  expect(p.cloner).toEqual({ x: p.base.x - 3, y: p.base.y });
  expect(lab.at).toBe(p.cloner);
  for (const c of footprint(lab.at)) expect(p.s.map.tiles[idx(p.s.map, c)]).toBe('chasm');
});

it('carrying a soul alone prints nothing: a body is printed only when the player asks (from anywhere on the pod’s ground)', () => {
  const p = newSurface(4); calm(p);
  p.carried = ['mage'];
  for (let i = 0; i < 40; i++) worldTick(p, 0.1);
  expect(clones(p)).toHaveLength(1);
  // base mode: the lab is used from anywhere on the pod's ground
  entOf(p, 'hero')!.pos = { x: p.base.x + 30, y: p.base.y };
  expect(canPrintClone(p)).toBe(true);
  expect(printClone(p).some((e) => e.text === 'print')).toBe(true);
  const fresh = clones(p)[1]!;
  expect(fresh.cls).toBe('shell');
  expect(dist(entOf(p, fresh.id)!.pos, p.cloner!)).toBeLessThanOrEqual(2);
  implantCarried(p, fresh.id, 0); expect(fresh.cls).toBe('mage');
});

it('a fresh surface party prints a body with no resources at all; no body past the beds (the besieged base prints in the middle of its fight)', () => {
  const p = newSurface(4); calm(p);
  entOf(p, 'hero')!.pos = { x: p.cloner!.x, y: p.cloner!.y + 1 };
  expect(p.ore + p.crystal).toBe(0); expect(canPrintClone(p)).toBe(true);
  p.combat = true; expect(canPrintClone(p)).toBe(true);
  printClone(p); expect(p.ore + p.crystal).toBe(0); expect('bio' in p).toBe(false);
  // two beds to begin with; a bed more, a clone more; no lab or no quarters, no body
  for (let i = 1; i < 5; i++) printClone(p);
  expect(cloneCap(p)).toBe(2); expect(clones(p)).toHaveLength(2); expect(canPrintClone(p)).toBe(false);
  p.upgrades = { beds: 1 }; expect(cloneCap(p)).toBe(3); expect(canPrintClone(p)).toBe(true);
  moduleOf(p, 'quarters')!.broken = true; expect(canPrintClone(p)).toBe(false);
  moduleOf(p, 'quarters')!.broken = false; moduleOf(p, 'lab')!.broken = true; expect(canPrintClone(p)).toBe(false);
});
