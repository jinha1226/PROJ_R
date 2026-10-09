import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { canUpgrade, cloneCap, footprint, GATHER, moduleAt, moduleOf, moduleOn, repairModule, upgrade, upgradeCost, upgradeLevel, upgradeOn, WORKSHOP_REPAIR } from '../../src/sim/base/modules';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { sacrificeRate } from '../../src/sim/delve/gear';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { print } from '../../src/sim/roam/roam';
import { tileAt, walkable } from '../../src/sim/grid/types';

it('the pod lands with three modules round it, each four cells in the way: the lab and the quarters working, the workshop broken', () => {
  const p = newSurface(42);
  expect(p.modules!.map((m) => m.id)).toEqual(['lab', 'quarters', 'workshop']);
  for (const m of p.modules!) for (const c of footprint(m.at)) { expect(walkable(tileAt(p.s.map, c))).toBe(false); expect(moduleAt(p, c)).toBe(m); }
  expect(moduleOn(p, 'lab')).toBe(true); expect(moduleOn(p, 'quarters')).toBe(true); expect(moduleOn(p, 'workshop')).toBe(false);
  expect(moduleOf(p, 'workshop')!.broken).toBe(true);
});

it('the workshop is mended once for ore, and that is what opens it; nothing else is ever broken', () => {
  const p = newSurface(42), shop = moduleOf(p, 'workshop')!;
  expect(repairModule(p, 'workshop')).toBe(false);
  p.ore = 50; expect(repairModule(p, 'workshop')).toBe(true);
  expect(p.ore).toBe(50 - WORKSHOP_REPAIR); expect(shop.broken).toBe(false); expect(moduleOn(p, 'workshop')).toBe(true);
  expect(repairModule(p, 'workshop')).toBe(false); expect(repairModule(p, 'lab')).toBe(false);
});

it('upgrades are steps bought with ore and crystal at their module: beds, salvage; the workshop sells none until it is mended', () => {
  const p = newSurface(42); p.ore = 1000; p.crystal = 100;
  expect(cloneCap(p)).toBe(2);
  for (let k = 0; k < 9; k++) upgrade(p, 'beds');
  expect(upgradeLevel(p, 'beds')).toBe(4); expect(cloneCap(p)).toBe(6); expect(upgradeCost(p, 'beds')).toBeUndefined();
  expect(p.ore).toBe(1000 - 30 - 50 - 80 - 120); expect(p.crystal).toBe(100 - 5 - 10);
  // the workshop is broken: nothing of its can be bought until it is mended
  expect(canUpgrade(p, 'salvage')).toBe(false); expect(upgrade(p, 'salvage')).toBe(false);
  expect(sacrificeRate(p)).toBe(0.25);
  repairModule(p, 'workshop');
  expect(upgrade(p, 'salvage')).toBe(true);
  expect(sacrificeRate(p)).toBe(0.35);
  moduleOf(p, 'workshop')!.broken = true; expect(sacrificeRate(p)).toBe(0.25);
  p.ore = 0; expect(canUpgrade(p, 'gather')).toBe(false);
});

it('gathering, switched on at the core: each clone left at home brings a little ore per trip down', () => {
  const p = newSurface(42); p.ore = 100;
  const other = print(p, undefined, [], p.s.map.start)!, third = print(p, undefined, [], p.s.map.start)!;
  const trip = () => { const d = departSurface(p, 5, takeClone(p, 'hero'))!; return returnToSurface(p, takeParty(d)); };
  const ore = p.ore;
  expect(trip().some((e) => e.text === 'gather')).toBe(false); expect(p.ore).toBe(ore);
  expect(upgrade(p, 'gather')).toBe(true);
  const ev = trip();
  expect(ev.find((e) => e.text === 'gather')?.amount).toBe(2 * GATHER.ore);
  expect(p.ore).toBe(ore - 40 + 2 * GATHER.ore);
  expect(other.id).not.toBe(third.id);
});

it('the medical bay, switched on at the lab: a clone comes home to full health', () => {
  const p = newSurface(42); p.ore = 100; p.crystal = 10;
  expect(upgrade(p, 'medical')).toBe(true); expect(upgradeOn(p, 'medical')).toBe(true);
  const d = departSurface(p, 5, takeClone(p, 'hero'))!; d.s.hero.hp = 1;
  returnToSurface(p, takeParty(d));
  expect(p.s.hero.hp).toBe(p.s.hero.maxHp);
});
