import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { departSurface } from '../../src/sim/base/trips';
import { applySf, buySoulSlot, canCraft, craft, dismantle, fit, sfOf, soulSlotCost } from '../../src/sim/base/workshop';
import { sfModules } from '../../src/sim/base/sfModules';
import { entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { numbers } from '../../src/sim/delve/gear';
import { blank, implant, print, slotsOf } from '../../src/sim/roam/roam';
import { spawnFoe } from '../../src/sim/grid/foes';
import { takeClone } from '../../src/sim/roam/carry';
import { tagsOf } from '../../src/sim/party/classKit';
import { sourcesOf } from '../../src/sim/party/triggers';

const base = () => { const p = newSurface(3); p.ore = 500; p.crystal = 100; return p; };
const give = (p: ReturnType<typeof base>, def: string) => { const id = `t-${p.nextItem++}`; p.pack.push({ id, def, power: 0 }); return id; };
const mod = (from: string) => sfModules().find((m) => m.from === from)!;

it('one module per fantasy weapon or armour with an effect: weapons feed the gun, armour the suit', () => {
  const all = sfModules();
  expect(all.length).toBe(26);
  expect(mod('flameSword')).toMatchObject({ part: 'gun', name: '소이탄', tags: ['근접', '화염'] });
  expect(mod('thornPlate')).toMatchObject({ part: 'suit', name: '반응 장갑' });
  expect(all.some((m) => m.from === 'pistol' || m.from === 'agentSuit')).toBe(false);
});

it('dismantling a fantasy weapon opens its blueprint, powers the gun like a sacrifice and uses the item up', () => {
  const p = base(), u = unitOf(p, 'hero')!, id = give(p, 'flameSword');
  const before = numbers(u.gear!.weapon!).max;
  expect(dismantle(p, id).length).toBeGreaterThan(0);
  expect(sfOf(p).blueprints).toContain(mod('flameSword').id);
  expect(p.pack.some((it) => it.id === id)).toBe(false);
  expect(numbers(u.gear!.weapon!).max).toBeGreaterThan(before);
  expect(dismantle(p, give(p, 'windRing'))).toEqual([]);
});

it('a module is crafted once, from its blueprint, for its cost; then fitted: two on the gun, one on the suit, no repeats', () => {
  const p = base(), fire = mod('flameSword').id, venom = mod('viper').id, shock = mod('mace').id, thorn = mod('thornPlate').id;
  expect(canCraft(p, fire)).toBe(false);
  for (const d of ['flameSword', 'viper', 'mace', 'thornPlate']) dismantle(p, give(p, d));
  const ore = p.ore;
  expect(craft(p, fire)).toBe(true); expect(p.ore).toBeLessThan(ore); expect(craft(p, fire)).toBe(false);
  craft(p, venom); craft(p, shock); craft(p, thorn);
  expect(fit(p, 'gun', 0, fire)).toBe(true); expect(fit(p, 'gun', 1, fire)).toBe(false);
  expect(fit(p, 'gun', 1, venom)).toBe(true); expect(fit(p, 'gun', 2, shock)).toBe(false);
  expect(fit(p, 'suit', 0, fire)).toBe(false); expect(fit(p, 'suit', 0, thorn)).toBe(true);
  expect(sfOf(p).fitted).toEqual({ gun: [fire, venom], suit: [thorn] });
});

it('a fitted module works on an empty body: its effect fires and its tags count; a body with a soul gets none of it', () => {
  const p = base(), u = unitOf(p, 'hero')!;
  dismantle(p, give(p, 'flameSword')); craft(p, mod('flameSword').id); fit(p, 'gun', 0, mod('flameSword').id);
  expect(tagsOf(u).화염).toBeGreaterThanOrEqual(1);
  expect(sourcesOf(p, u).map((d) => d.id)).toContain('불꽃 칼날');
  const me = entOf(p, 'hero')!.pos, fe = spawnFoe(p.s, 'minion', { x: me.x + 2, y: me.y }, true), foe: Unit = { ...blank(), id: fe.id, side: 'foe', foe: 'goblin' };
  p.units.push(foe); fe.hp = fe.maxHp = 999;
  p.s.rng.chance = () => true;
  strike(p, u, foe, p.time, []);
  expect((foe.status.burn?.until ?? 0) > p.time).toBe(true);
  const b = print(p, undefined, [], p.cloner!)!;
  applySf(p, b); implant(p, b, 'warrior', []);
  expect(sourcesOf(p, b).map((d) => d.id)).not.toContain('불꽃 칼날');
  expect(tagsOf(b).화염 ?? 0).toBe(0);
});

it('dismantled armour thickens the suit', () => {
  const p = base(), u = unitOf(p, 'hero')!, before = numbers(u.gear!.armor!).armor;
  dismantle(p, give(p, 'ironPlate'));
  expect(numbers(u.gear!.armor!).armor).toBeGreaterThan(before);
});

it('the soul-slot upgrade adds a slot and doubles its price', () => {
  const p = base(), cost = soulSlotCost(p), slots = slotsOf(p);
  expect(buySoulSlot(p)).toBe(true);
  expect(slotsOf(p)).toBe(slots + 1); expect(p.crystal).toBe(100 - cost); expect(soulSlotCost(p)).toBe(cost * 2);
  p.crystal = 0; expect(buySoulSlot(p)).toBe(false);
});

it('refitting at home after a clone left does not change the run it is on', () => {
  const p = base(), b = print(p, undefined, [], p.drill!)!;
  entOf(p, b.id)!.pos = { ...p.drill! };
  dismantle(p, give(p, 'flameSword')); craft(p, mod('flameSword').id); fit(p, 'gun', 0, mod('flameSword').id);
  const d = departSurface(p, 5, takeClone(p, b.id))!;
  const below = d.units.find((x) => x.id === b.id)!, power = below.gear!.weapon!.power;
  dismantle(p, give(p, 'stormAxe')); fit(p, 'gun', 0, null);
  expect(below.gear!.weapon!.power).toBe(power);
  expect(below.sfMods).toEqual([mod('flameSword').id]);
});
