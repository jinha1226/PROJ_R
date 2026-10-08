import { expect, it } from 'vitest';
import { newSurface, drillClone, canDrill } from '../../src/sim/overworld/worldSim';
import { homeLife, HOME_RANGE } from '../../src/sim/base/baseLife';
import { canPrintClone } from '../../src/sim/base/cloner';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { dist, idx } from '../../src/sim/grid/types';
import { BODY_COST, print } from '../../src/sim/roam/roam';

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
  // another clone is sound, so the injured one stays home
  print(p, undefined, [], p.s.map.start); u.injured = true;
  expect(drillClone(p, 'hero')).not.toBe('hero'); expect(canDrill(p, 'hero')).toBe(false);
  // (a bed more than the two it began with)
  p.upgrades = { beds: 1 }; p.bio = BODY_COST; expect(canPrintClone(p)).toBe(true);
});

it('with the core\'s gathering on, a clone at home goes to a cell beside the pod or a module and works there', async () => {
  const { homeLife } = await import('../../src/sim/base/baseLife');
  const { worldTick } = await import('../../src/sim/overworld/worldSim');
  const { targets } = await import('../../src/sim/base/raidPath');
  const p = newSurface(4), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
  p.upgrades = { gather: 1 };
  let swings = 0;
  for (let k = 0; k < 120; k++) { homeLife(p, p.time); swings += worldTick(p, 0.2).filter((x) => x.text === 'work' && x.src === 'hero').length; }
  expect(swings).toBeGreaterThan(1);
  expect(u.workCell).toBeDefined();
  const beside = targets(p).some((t) => t.cells.some((c) => Math.abs(c.x - u.workCell!.x) + Math.abs(c.y - u.workCell!.y) === 1));
  expect(beside).toBe(true); expect(Math.max(Math.abs(e.pos.x - p.base.x), Math.abs(e.pos.y - p.base.y))).toBeLessThan(8);
});
