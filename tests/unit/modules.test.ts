import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { place } from '../../src/sim/base/buildings';
import { canMoveModule, canUpgrade, cloneCap, footprint, GATHER, moduleAt, MODULE_HP, moduleOf, moduleOn, moduleRepairCost, moveModule, repairModule, upgrade, upgradeCost, upgradeLevel, upgradeOn } from '../../src/sim/base/modules';
import { setPost } from '../../src/sim/base/posts';
import { startRaid } from '../../src/sim/base/raids';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { sacrificeRate } from '../../src/sim/delve/gear';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { print } from '../../src/sim/roam/roam';
import { idx, same, tileAt, walkable, type GEvent } from '../../src/sim/grid/types';

it('the pod lands with three modules round it, each four cells in the way: the lab and the quarters whole, the workshop broken', () => {
  const p = newSurface(42);
  expect(p.modules!.map((m) => m.id)).toEqual(['lab', 'quarters', 'workshop']);
  for (const m of p.modules!) for (const c of footprint(m.at)) { expect(walkable(tileAt(p.s.map, c))).toBe(false); expect(moduleAt(p, c)).toBe(m); }
  expect(moduleOn(p, 'lab')).toBe(true); expect(moduleOn(p, 'quarters')).toBe(true); expect(moduleOn(p, 'workshop')).toBe(false);
  expect(moduleOf(p, 'workshop')).toMatchObject({ hp: 0, broken: true });
});

it('a module is moved by day for nothing: onto our own open ground, never onto the pod, a barricade, a post or another module', () => {
  const p = newSurface(42), q = moduleOf(p, 'quarters')!, old = footprint(q.at), b = p.base;
  const to = { x: b.x + 2, y: b.y };
  expect(canMoveModule(p, 'quarters', to)).toBe(true);
  expect(moveModule(p, 'quarters', to)).toBe(true);
  expect(q.at).toEqual(to);
  for (const c of footprint(to)) expect(walkable(tileAt(p.s.map, c))).toBe(false);
  // the cell it left that it does not still cover is open ground again
  expect(walkable(tileAt(p.s.map, old[1]!))).toBe(true);
  expect(canMoveModule(p, 'quarters', { x: b.x + 1, y: b.y })).toBe(false);
  expect(canMoveModule(p, 'quarters', moduleOf(p, 'lab')!.at)).toBe(false);
  expect(canMoveModule(p, 'quarters', { x: 3, y: 3 })).toBe(false);
  place(p, { x: b.x + 6, y: b.y + 5 }); expect(canMoveModule(p, 'quarters', { x: b.x + 5, y: b.y + 5 })).toBe(false);
  setPost(p, 'hero', { x: b.x - 6, y: b.y + 5 }); expect(canMoveModule(p, 'quarters', { x: b.x - 6, y: b.y + 4 })).toBe(false);
  // not while a raid is on
  startRaid(p); expect(canMoveModule(p, 'quarters', { x: b.x + 4, y: b.y - 5 })).toBe(false);
});

it('the lab carries the clone printer with it, and a clone standing where a module goes steps aside', () => {
  const p = newSurface(42), lab = moduleOf(p, 'lab')!, e = entOf(p, 'hero')!;
  const to = { x: p.base.x - 6, y: p.base.y + 4 };
  e.pos = { x: to.x + 1, y: to.y }; unitOf(p, 'hero')!.order = null;
  const ev: GEvent[] = [];
  expect(moveModule(p, 'lab', to, ev)).toBe(true);
  expect(p.cloner).toEqual(to); expect(lab.at).toBe(p.cloner);
  expect(footprint(to).some((c) => same(c, e.pos))).toBe(false); expect(walkable(tileAt(p.s.map, e.pos))).toBe(true);
  expect(ev).toMatchObject([{ type: 'move', src: 'hero' }]);
  const fresh = print(p, undefined, [], p.cloner)!;
  expect(Math.max(Math.abs(entOf(p, fresh.id)!.pos.x - to.x), Math.abs(entOf(p, fresh.id)!.pos.y - to.y))).toBeLessThanOrEqual(3);
});

it('a module is mended for ore (an ore for six points); the workshop’s first repair is what opens it', () => {
  const p = newSurface(42), shop = moduleOf(p, 'workshop')!, lab = moduleOf(p, 'lab')!;
  expect(moduleRepairCost(shop)).toBe(40); expect(repairModule(p, 'workshop')).toBe(false);
  p.ore = 50; expect(repairModule(p, 'workshop')).toBe(true);
  expect(p.ore).toBe(10); expect(shop).toMatchObject({ hp: MODULE_HP, broken: false }); expect(moduleOn(p, 'workshop')).toBe(true);
  lab.hp = MODULE_HP - 30; expect(moduleRepairCost(lab)).toBe(5);
  expect(repairModule(p, 'lab')).toBe(true); expect(p.ore).toBe(5); expect(repairModule(p, 'lab')).toBe(false);
});

it('upgrades are steps bought with ore and crystal at their module: beds, barricade stock, salvage; a broken module sells none', () => {
  const p = newSurface(42); p.ore = 1000; p.crystal = 100;
  expect(cloneCap(p)).toBe(2);
  for (let k = 0; k < 9; k++) upgrade(p, 'beds');
  expect(upgradeLevel(p, 'beds')).toBe(4); expect(cloneCap(p)).toBe(6); expect(upgradeCost(p, 'beds')).toBeUndefined();
  expect(p.ore).toBe(1000 - 30 - 50 - 80 - 120); expect(p.crystal).toBe(100 - 5 - 10);
  // the workshop is broken: nothing of its can be bought until it is mended
  expect(canUpgrade(p, 'stock')).toBe(false); expect(upgrade(p, 'salvage')).toBe(false);
  expect(sacrificeRate(p)).toBe(0.25);
  repairModule(p, 'workshop');
  expect(upgrade(p, 'stock')).toBe(true); expect(upgrade(p, 'salvage')).toBe(true);
  expect(sacrificeRate(p)).toBe(0.35);
  moduleOf(p, 'workshop')!.broken = true; expect(sacrificeRate(p)).toBe(0.25);
  p.ore = 0; expect(canUpgrade(p, 'gather')).toBe(false);
});

it('gathering, switched on at the core: each clone left at home brings a little ore and bio-matter per trip down', () => {
  const p = newSurface(42); p.ore = 100;
  const other = print(p, undefined, [], p.s.map.start)!, third = print(p, undefined, [], p.s.map.start)!;
  const trip = () => { const d = departSurface(p, 5, takeClone(p, 'hero'))!; return returnToSurface(p, takeParty(d)); };
  const ore = p.ore, bio = p.bio;
  expect(trip().some((e) => e.text === 'gather')).toBe(false); expect(p.ore).toBe(ore);
  expect(upgrade(p, 'gather')).toBe(true);
  const ev = trip();
  expect(ev.find((e) => e.text === 'gather')?.amount).toBe(2 * GATHER.ore);
  expect(p.ore).toBe(ore - 40 + 2 * GATHER.ore); expect(p.bio).toBe(bio + 2 * GATHER.bio);
  expect(other.id).not.toBe(third.id);
});

it('the medical bay, switched on at the lab: a clone comes home to full health, and a raid leaves nobody injured — while the lab stands', () => {
  const p = newSurface(42); p.ore = 100; p.crystal = 10;
  print(p, undefined, [], p.s.map.start);
  expect(upgrade(p, 'medical')).toBe(true); expect(upgradeOn(p, 'medical')).toBe(true);
  const d = departSurface(p, 5, takeClone(p, 'hero'))!; d.s.hero.hp = 1;
  returnToSurface(p, takeParty(d));
  expect(p.s.hero.hp).toBe(p.s.hero.maxHp);
  startRaid(p); p.raidQueue = [];
  entOf(p, 'hero')!.alive = false;
  for (const u of p.units.filter((x) => x.group === p.raid!.group)) entOf(p, u.id)!.alive = false;
  worldTick(p, 0.1);
  expect(p.raid).toBeNull(); expect(unitOf(p, 'hero')!.injured).toBeFalsy(); expect(p.lastRaid!.injured).toEqual([]);
  // the lab broken, the bay is off
  moduleOf(p, 'lab')!.broken = true; expect(upgradeOn(p, 'medical')).toBe(false);
});

it('a raid that breaks a module leaves it broken (it is named in the result) until it is mended', () => {
  const p = newSurface(42);
  startRaid(p); p.raidQueue = [];
  const lab = moduleOf(p, 'lab')!; lab.hp = 0; lab.broken = true;
  for (const u of p.units.filter((x) => x.group === p.raid!.group)) entOf(p, u.id)!.alive = false;
  worldTick(p, 0.1);
  expect(p.lastRaid!.modules).toEqual(['lab']); expect(lab.broken).toBe(true);
  expect(p.s.map.tiles[idx(p.s.map, lab.at)]).toBe('chasm');
});
