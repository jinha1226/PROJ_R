import { expect, it } from 'vitest';
import { newSurface, drillClone, canDrill } from '../../src/sim/overworld/worldSim';
import { homeLife, HOME_RANGE } from '../../src/sim/base/baseLife';
import { canPrintClone } from '../../src/sim/base/cloner';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { dist, idx } from '../../src/sim/grid/types';
import { BODY_COST } from '../../src/sim/roam/roam';

it('idle clones at the base walk off to a claimed cell near the pod now and then', () => {
  const p = newSurface(4), u = unitOf(p, 'hero')!;
  homeLife(p, 0);
  const o = u.order;
  expect(o?.kind).toBe('move');
  if (o?.kind !== 'move') return;
  expect(dist(o.cell, p.base)).toBeLessThanOrEqual(HOME_RANGE);
  expect(p.claimed[idx(p.s.map, o.cell)]).toBe(1);
  // busy until it gets there; then rests a while before the next stroll
  u.order = null; homeLife(p, 0.5);
  expect(u.order).toBeNull();
});

it('nobody strolls during a raid or a raid night', () => {
  const p = newSurface(4), u = unitOf(p, 'hero')!;
  p.raidReady = { size: 30, sides: [0] }; homeLife(p, 0); expect(u.order).toBeNull();
  p.raidReady = null; p.raid = { group: 1000, size: 30 }; homeLife(p, 0); expect(u.order).toBeNull();
});

it('on the pod’s ground any clone at the base can be sent down or print a body, wherever it stands; an injured one cannot go', () => {
  const p = newSurface(4), u = unitOf(p, 'hero')!;
  entOf(p, 'hero')!.pos = { x: p.base.x + 5, y: p.base.y };
  expect(drillClone(p, 'hero')).toBe('hero'); expect(canDrill(p, 'hero')).toBe(true);
  u.injured = true;
  expect(drillClone(p, 'hero')).toBeUndefined(); expect(canDrill(p, 'hero')).toBe(false);
  p.bio = BODY_COST; expect(canPrintClone(p)).toBe(true);
});
