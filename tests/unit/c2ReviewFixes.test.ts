import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { newDelve } from '../../src/sim/delve/delveSim';
import { canEquip, equip, sacrifice, unequip } from '../../src/sim/delve/gear';
import { craft, dismantle, fit, sfOf } from '../../src/sim/base/workshop';
import { gearTaken } from '../../src/sim/delve/catalogEffects';
import { entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { implant, clones, living } from '../../src/sim/roam/roam';
import { benchModel } from '../../src/ui/overworld/workbench/benchModel';
import { benchHtml } from '../../src/ui/overworld/workbench/benchHtml';
import type { GEvent } from '../../src/sim/grid/types';

const base = () => { const p = newSurface(3); p.ore = 500; p.crystal = 100; p.bio = 100; return p; };
const give = (p: ReturnType<typeof base>, def: string) => { const id = `t-${p.nextItem++}`; p.pack.push({ id, def, power: 0 }); return id; };

it('the empty body kit cannot be sacrificed into, unequipped, or worn by a soul body', () => {
  const p = base(), u = unitOf(p, 'hero')!, sword = give(p, 'flameSword');
  expect(sacrifice(p, 'hero', sword)).toEqual([]);
  expect(p.pack.some((it) => it.id === sword)).toBe(true);
  expect(unequip(p, 'hero', 'weapon')).toBe(false);
  expect(u.gear!.weapon!.def).toBe('pistol');
  const v = clones(p)[0]!; implant(p, v, 'warrior', []);
  const kit = give(p, 'pistol');
  expect(canEquip(v, p.pack.find((it) => it.id === kit)!)).toBe(false);
  expect(equip(p, v.id, kit)).toBe(false);
});

it('a body woken after a wipe carries the workshop too', () => {
  const p = base();
  dismantle(p, give(p, 'flameSword'));
  const power = sfOf(p).gun.power;
  entOf(p, 'hero')!.alive = false;
  for (let i = 0; i < 50 && !living(p).length; i++) worldTick(p, 0.1);
  const woke = living(p)[0]!;
  expect(woke.gear!.weapon!.power).toBe(power);
});

it('the 고정 장갑 module guards like the iron plate', () => {
  const p = base(), u = unitOf(p, 'hero')!;
  dismantle(p, give(p, 'ironPlate')); craft(p, 'sf-ironPlate'); fit(p, 'suit', 0, 'sf-ironPlate');
  u.ironGuard = true; u.still = 2;
  expect(gearTaken(u)).toBeLessThan(1);
});

it('해제 empties the slot the module sits in, not the slot selected', () => {
  const p = base();
  for (const d of ['flameSword', 'viper']) dismantle(p, give(p, d));
  craft(p, 'sf-flameSword'); craft(p, 'sf-viper'); fit(p, 'gun', 0, 'sf-flameSword'); fit(p, 'gun', 1, 'sf-viper');
  const html = benchHtml(benchModel(p), { part: 'gun', slot: 'gun1' });
  expect(html).toContain('data-act="unfit" data-id="sf-flameSword" data-index="0"');
  expect(html).toContain('data-act="unfit" data-id="sf-viper" data-index="1"');
});

it('butt stroke: the push event names the foe that moves', () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 9; y++) for (let x = 2; x < 16; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 5, y: 5 };
  for (const f of p.units) if (f.side === 'foe') { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!;
  fe.alive = true; fe.hp = fe.maxHp = 999; fe.pos = { x: 6, y: 5 }; foe.asleep = false; foe.reaped = false;
  foe.sighted = [u.id]; u.traits = { buttStroke: 1 }; p.s.rng.chance = () => true;
  const ev: GEvent[] = []; strike(p, u, foe, p.time, ev);
  const push = ev.find((e) => e.type === 'push')!;
  expect(push.src).toBe(foe.id);
});

it('a first soul keeps the accessory the empty body wore', () => {
  const p = base(), u: Unit = clones(p)[0]!;
  u.gear!.accessory = { id: 'acc', def: 'windRing', power: 0 };
  implant(p, u, 'mage', []);
  expect(u.gear!.accessory?.def).toBe('windRing');
});
