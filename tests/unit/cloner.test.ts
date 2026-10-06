import { expect, it } from 'vitest';
import { entOf } from '../../src/sim/party/partyCore';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { canPrintClone, printClone } from '../../src/sim/base/cloner';
import { BODY_COST, clones, implantCarried, MAX_CLONES } from '../../src/sim/roam/roam';
import { dist, idx } from '../../src/sim/grid/types';

const calm = (p: ReturnType<typeof newSurface>) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; };

it('the pod lands with its lab beside it: a clone printer in the way, a cell of its own', () => {
  const p = newSurface(4);
  expect(p.cloner).toEqual({ x: p.base.x - 3, y: p.base.y });
  expect(p.ground[idx(p.s.map, p.cloner!)]).toBe('cloner');
  expect(p.s.map.tiles[idx(p.s.map, p.cloner!)]).toBe('chasm');
});

it('bio-matter alone prints nothing: a body is printed only when the player asks, by the printer', () => {
  const p = newSurface(4); calm(p);
  p.bio = 100; p.carried = ['mage'];
  for (let i = 0; i < 40; i++) worldTick(p, 0.1);
  expect(clones(p)).toHaveLength(1);
  entOf(p, 'hero')!.pos = { x: p.base.x + 30, y: p.base.y };
  expect(canPrintClone(p)).toBe(false); expect(printClone(p)).toEqual([]);
  entOf(p, 'hero')!.pos = { x: p.cloner!.x, y: p.cloner!.y + 1 };
  expect(canPrintClone(p)).toBe(true);
  expect(printClone(p).some((e) => e.text === 'print')).toBe(true);
  const fresh = clones(p)[1]!;
  expect(fresh.cls).toBe('shell'); expect(p.bio).toBe(100 - BODY_COST);
  expect(dist(entOf(p, fresh.id)!.pos, p.cloner!)).toBeLessThanOrEqual(2);
  implantCarried(p, fresh.id, 0); expect(fresh.cls).toBe('mage');
});

it('no body without the bio-matter, in a fight, or past the clone limit', () => {
  const p = newSurface(4); calm(p);
  entOf(p, 'hero')!.pos = { x: p.cloner!.x, y: p.cloner!.y + 1 };
  p.bio = BODY_COST - 1; expect(canPrintClone(p)).toBe(false);
  p.bio = 999; p.combat = true; expect(canPrintClone(p)).toBe(false);
  p.combat = false;
  for (let i = 1; i < MAX_CLONES; i++) printClone(p);
  expect(clones(p)).toHaveLength(MAX_CLONES); expect(canPrintClone(p)).toBe(false);
});
