import { expect, it } from 'vitest';
import { G, starterGear } from '../../src/sim/delve/gear';
import { damage, entOf, stats, strike, unitOf } from '../../src/sim/party/partyCore';
import { basicHit, tickBurns } from '../../src/sim/party/partyEngrave';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { useUltimate } from '../../src/sim/party/ultimate';
import { newDelve } from '../../src/sim/delve/delveSim';
import { takeParty } from '../../src/sim/roam/carry';
import type { GEvent } from '../../src/sim/grid/types';

const setup = () => {
  const p = partyRoom();
  for (const u of p.units) if (u.cls) u.gear = starterGear(u.cls, () => u.id);
  return p;
};

it('gear factors include both affix carriers, magic armor, and trinkets', () => {
  const p = setup(), u = unitOf(p, 'ally-2')!;
  u.gear!.weapon.rarity = 'rare'; u.gear!.weapon.affix = 'keen';
  u.gear!.armor = { id: 'a', kind: 'armor', base: 'plate', rarity: 'rare', affix: 'keen' };
  u.gear!.trinkets = ['swift', 'focus'];
  expect(G.dmg(u)).toBeCloseTo(1.15 ** 3);
  expect(G.cd(u)).toBeCloseTo(1);
  expect(G.reduce(u)).toBeCloseTo(0.3);
  expect(stats(u).atk).toBeCloseTo(1.3 * 1.1 * 0.85);
  expect(stats(u).move).toBeCloseTo(1.15);
  u.gear!.weapon.affix = 'quick'; u.gear!.armor.affix = 'focused';
  expect(G.atk(u)).toBeCloseTo(1.1 * 0.88 * 0.85);
  expect(G.cd(u)).toBeCloseTo(0.85);
});

it('taunt exposure, foreign marks, shatter and executioner affect direct skill damage', () => {
  const p = setup(), u = unitOf(p, 'hero')!, a = unitOf(p, 'ally-1')!, foe = p.units.find((x) => x.side === 'foe')!;
  const f = entOf(p, foe.id)!;
  f.pos = { ...entOf(p, u.id)!.pos, x: 4 }; f.hp = f.maxHp = 500;
  u.gear!.trinkets = ['link_bait', null]; useUltimate(p, u.id);
  damage(p, 0, a.id, foe, 10, []); expect(f.hp).toBe(485);
  foe.markBy = u.id; foe.markUntil = 4;
  damage(p, 0, a.id, foe, 10, []); expect(f.hp).toBe(465);
  damage(p, 0, u.id, foe, 10, []); expect(f.hp).toBe(450);
  foe.exposedUntil = 0; foe.markUntil = 0; foe.frozenUntil = 4;
  a.gear!.trinkets = ['link_shatter', 'executioner'];
  f.hp = 100; damage(p, 0, a.id, foe, 10, []);
  expect(f.hp).toBe(70); expect(foe.frozenUntil).toBe(0);
});

it('guard links transfer once even when both adjacent heroes wear one', () => {
  const p = setup(), a = unitOf(p, 'ally-1')!, b = unitOf(p, 'ally-2')!;
  entOf(p, a.id)!.pos = { x: 3, y: 3 }; entOf(p, b.id)!.pos = { x: 3, y: 4 };
  a.gear!.trinkets = ['link_guard', null]; b.gear!.trinkets = ['link_guard', null];
  const ah = entOf(p, a.id)!.hp, bh = entOf(p, b.id)!.hp;
  damage(p, 0, 'x', a, 10, []);
  expect(entOf(p, a.id)!.hp).toBe(ah - 7); expect(entOf(p, b.id)!.hp).toBe(bh - 3);
});

it('echo only responds to another nearby successful cast and retains stronger empowerment', () => {
  const p = setup(), a = unitOf(p, 'ally-1')!, caster = unitOf(p, 'hero')!;
  a.gear!.trinkets = ['link_echo', null]; a.empower = 2.5;
  useUltimate(p, caster.id); expect(a.empower).toBe(2.5);
  a.empower = 1; caster.ultReady = 0;
  useUltimate(p, caster.id); expect(a.empower).toBe(2);
  a.empower = 1; useUltimate(p, caster.id); expect(a.empower).toBe(1);
});

it('basic-hit procs heal actual damage and burn three ticks; frostbite delays the next moment', () => {
  const p = setup(), u = unitOf(p, 'hero')!, foe = p.units.find((x) => x.side === 'foe')!;
  const e = entOf(p, u.id)!, f = entOf(p, foe.id)!;
  u.gear!.trinkets = ['vampire', 'ember']; e.hp = 10;
  p.s.rng.chance = () => true;
  basicHit(p, u, foe, 0, 10, []); expect(e.hp).toBe(12);
  const hp = f.hp; tickBurns(p, 4, []); expect(f.hp).toBe(hp - 9);
  u.gear!.trinkets = ['frostbite', 'link_mark']; foe.nextAt = 5;
  basicHit(p, u, foe, 4, 1, []);
  expect(foe.nextAt).toBe(6); expect(foe.markBy).toBe(u.id); expect(foe.markUntil).toBe(8);
});

it('skill strikes do not consume echo or trigger basic-only procs; thorns reflect melee once', () => {
  const p = setup(), u = unitOf(p, 'hero')!, foe = p.units.find((x) => x.side === 'foe')!;
  u.gear!.trinkets = ['link_mark', 'ember']; u.empower = 2; u.echoPending = true;
  p.s.rng.chance = (chance) => chance > 0;
  entOf(p, foe.id)!.hp = entOf(p, foe.id)!.maxHp = 100;
  strike(p, u, foe, 0, [], 1, false);
  expect(foe.markBy).toBeUndefined(); expect(foe.burnUntil).toBeUndefined(); expect(u.empower).toBe(2);
  u.gear!.trinkets = ['thorns', null];
  const hp = entOf(p, foe.id)!.hp;
  strike(p, foe, u, 0, []);
  expect(entOf(p, foe.id)!.hp).toBeLessThanOrEqual(hp - 3);
});

it('burns advance with idle simulation and paused time does not advance them', () => {
  const p = setup(), foe = p.units.find((x) => x.side === 'foe')!;
  for (const u of p.units) u.nextAt = 100;
  foe.burnUntil = 3; foe.dotAt = 1;
  const hp = entOf(p, foe.id)!.hp;
  tick(p, 3); expect(entOf(p, foe.id)!.hp).toBe(hp - 9);
  p.waiting = true; const ev: GEvent[] = tick(p, 10); expect(ev).toEqual([]); expect(p.time).toBe(3);
});

it('pack, potions, IDs and independent loadouts travel across floors', () => {
  const p = newDelve(2);
  p.pack.push({ id: 'test', kind: 'trinket', base: 'swift' }); p.potions = 1; p.nextItem = 88;
  const carry = takeParty(p), q = newDelve(3, 2, carry);
  expect(q.pack).toEqual(p.pack); expect(q.potions).toBe(1); expect(q.nextItem).toBe(88);
  q.pack.pop(); expect(p.pack).toHaveLength(1);
  unitOf(q, 'hero')!.gear!.trinkets[0] = 'swift';
  expect(unitOf(p, 'hero')!.gear!.trinkets[0]).toBeNull();
});

it('skill attacks retain stealth empowerment while a pending echo waits for a basic attack', () => {
  const p = setup(), u = unitOf(p, 'hero')!, foe = p.units.find((x) => x.side === 'foe')!;
  entOf(p, foe.id)!.hp = entOf(p, foe.id)!.maxHp = 1000;
  p.s.rng.chance = (chance) => chance > 0;
  u.empower = 2.5; u.echoPending = true;
  strike(p, u, foe, 0, [], 2, false);
  expect(u.empower).toBe(2); expect(u.echoPending).toBe(true);
  strike(p, u, foe, 0, []);
  expect(u.empower).toBe(1); expect(u.echoPending).toBe(false);
});

it('starter armor follows the literal class rule and damage affixes scale skills once', () => {
  expect(starterGear('berserker', () => 'id').armor!.base).toBe('cloth');
  const p = setup(), u = unitOf(p, 'hero')!, foe = p.units.find((x) => x.side === 'foe')!;
  u.gear!.weapon.rarity = 'rare'; u.gear!.weapon.affix = 'keen';
  const e = entOf(p, foe.id)!, hp = e.hp;
  damage(p, 0, u.id, foe, 10, []);
  expect(hp - e.hp).toBe(Math.round(10 * 1.15 ** 2));
});
