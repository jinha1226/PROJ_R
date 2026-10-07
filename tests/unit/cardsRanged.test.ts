import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { action, emit } from '../../src/sim/party/triggers';
import { RANGED_CARDS } from '../../src/sim/party/cardsRanged';
import { scene, put } from './support/cardScene';

it('eight archer and eight mage cards', () => {
  expect(RANGED_CARDS.filter((d) => d.pool === 'archer')).toHaveLength(8);
  expect(RANGED_CARDS.filter((d) => d.pool === 'mage')).toHaveLength(8);
});

it('hunt mark: the first shot of a fight marks', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; u.gear = undefined; const [a] = foes; put(p, a!, 8, 4, 999);
  u.traits = { huntMark: 1 }; action(p, () => emit(p, 'combatStart', { t: 0, src: u, ev: [] }));
  p.s.rng.chance = () => true; strike(p, u, a!, 1, []);
  expect((a!.status.mark?.until ?? 0) > 1).toBe(true);
});

it('pierce: the shot goes on into the foe behind', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; u.gear = undefined; const [a, b] = foes; put(p, a!, 7, 4, 999); put(p, b!, 9, 4);
  u.traits = { pierce: 1 }; p.s.rng.chance = () => true; strike(p, u, a!, 1, []);
  expect(entOf(p, b!.id)!.hp).toBeLessThan(200);
});

it('spike trap: waiting cuts and pins the foes beside', () => {
  const { p, u, foes } = scene('archer'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { spikeTrap: 1 }; action(p, () => emit(p, 'wait', { t: 0, src: u, ev: [] }));
  expect(a!.status.bleed).toBeDefined(); expect(a!.status.stun).toBeDefined();
});

it('combust: a burning foe that dies blows up; upgraded, the blast can set off more blasts', () => {
  const { p, u, foes } = scene('mage'); const [a, b, c] = foes; put(p, a!, 5, 4); entOf(p, a!.id)!.hp = 1; put(p, b!, 6, 4, 10); put(p, c!, 7, 4);
  u.traits = { combust: 2 };
  applyStatus(p, u, a!, 'burn', 0, []); applyStatus(p, u, b!, 'burn', 0, []);
  damage(p, 0, u.id, a!, 99, []);
  expect(entOf(p, b!.id)!.alive).toBe(false); expect(entOf(p, c!.id)!.hp).toBeLessThan(200);
});

it('frost prison: a second chill freezes', () => {
  const { p, u, foes } = scene('mage'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { frostPrison: 1 };
  applyStatus(p, u, a!, 'chill', 0, []); applyStatus(p, u, a!, 'chill', 0.5, []);
  expect((a!.status.freeze?.until ?? 0) > 0).toBe(true);
});

it('elemental cycle: burn, then chill (which makes steam), then shock', () => {
  const { p, u, foes } = scene('mage'); u.weapon = 'staff'; u.gear = undefined; const [a] = foes; put(p, a!, 6, 4, 999);
  u.traits = { elemCycle: 1 }; p.s.rng.chance = () => true;
  strike(p, u, a!, 0, []); expect(a!.status.burn).toBeDefined();
  strike(p, u, a!, 1, []); expect(a!.status.burn).toBeUndefined();
});

it('mana backflow: a blow taken leaves a shield of 30% of it', () => {
  const { p, u, foes } = scene('mage'); const [a] = foes; put(p, a!, 5, 4); u.shield = 0;
  u.traits = { manaBack: 1 }; const e = entOf(p, u.id)!, before = e.hp; damage(p, 0, a!.id, u, 20, []);
  expect(u.shield).toBe(Math.round((before - e.hp) * 0.3));
});
