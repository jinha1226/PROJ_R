import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action, emit } from '../../src/sim/party/triggers';
import { COMMON_CARDS, KEYSTONE_CARDS } from '../../src/sim/party/cardsCommon';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { scene, put } from './support/cardScene';

it('twelve common cards and six oaths, each a card with a kind and a line', () => {
  expect(COMMON_CARDS).toHaveLength(12); expect(KEYSTONE_CARDS).toHaveLength(6);
  for (const d of [...COMMON_CARDS, ...KEYSTONE_CARDS]) { expect(d.kind, d.id).toBeDefined(); expect(d.text!.length, d.id).toBeGreaterThan(3); expect(TRAITS[d.id]).toBe(d); }
  expect(KEYSTONE_CARDS.every((d) => d.kind === 'oath' && d.pool === 'keystone')).toBe(true);
});

it('finish: a kill doubles the next blow; upgraded it stacks up to four times', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 1); put(p, b!, 5, 5);
  u.traits = { finish: 1 };
  damage(p, 0, u.id, a!, 50, []); expect(u.empower).toBe(2);
  u.traits = { finish: 2 }; u.empower = 3; put(p, a!, 5, 4, 1); damage(p, 0, u.id, a!, 50, []); expect(u.empower).toBe(4);
});

it('bloodthirst heals by the overkill', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 10);
  u.traits = { bloodthirst: 1 }; entOf(p, u.id)!.hp = 20;
  damage(p, 0, u.id, a!, 40, []);
  expect(entOf(p, u.id)!.hp).toBe(20 + (entOf(p, u.id)!.maxHp >= 50 ? 30 : entOf(p, u.id)!.maxHp - 20));
});

it('combo: every third attack strikes again', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { combo: 1 }; p.s.rng.chance = () => true; const ev: { type: string }[] = [];
  for (let i = 0; i < 3; i++) strike(p, u, a!, i, ev as never);
  expect(ev.filter((e) => e.type === 'bump').length).toBe(4);
});

it('first aid: waiting heals 15%', () => {
  const { p, u } = scene('warrior'); u.traits = { firstAid: 1 }; const e = entOf(p, u.id)!; e.hp = 10;
  action(p, () => emit(p, 'wait', { t: 0, src: u, ev: [] }));
  expect(e.hp).toBe(10 + Math.round(e.maxHp * 0.15));
});

it('unyielding: entering crisis gives a shield of 30% max health and exposes foes beside', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a] = foes; put(p, a!, 5, 4);
  u.traits = { unyielding: 1 }; const e = entOf(p, u.id)!; u.shield = 0;
  damage(p, 0, a!.id, u, Math.ceil(e.maxHp * 0.6), []);
  expect(u.shield).toBe(Math.round(e.maxHp * 0.3)); expect((a!.status.exposed?.until ?? 0) > 0).toBe(true);
});

it('initiative: the fight opens with this clone at once and its first blow critical', () => {
  const { p, u } = scene('warrior'); u.traits = { initiative: 1 }; u.nextAt = 5;
  action(p, () => emit(p, 'combatStart', { t: 1, src: u, ev: [] }));
  expect(u.nextAt).toBe(1); expect(u.nextCrit).toBe(true);
});
