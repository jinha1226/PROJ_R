import { expect, it } from 'vitest';
import { entOf, strike } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { action, emit } from '../../src/sim/party/triggers';
import { RANGED_CARDS } from '../../src/sim/party/cardsRanged';
import { scene, put } from './support/cardScene';

it('eight archer cards (the mage moved to its own file)', () => {
  expect(RANGED_CARDS.filter((d) => d.pool === 'archer')).toHaveLength(8);
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

