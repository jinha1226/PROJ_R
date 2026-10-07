import { expect, it } from 'vitest';
import { entOf, type Unit } from '../../src/sim/party/partyCore';
import { tick } from '../../src/sim/party/partySim';
import { applyStatus } from '../../src/sim/party/status';
import { bestTarget } from '../../src/sim/party/utility';
import { scene, put } from './support/cardScene';

const only = (p: ReturnType<typeof scene>['p'], u: Unit) => { for (const x of p.units) if (x !== u) x.nextAt = 999; u.nextAt = p.time; };

it('melee charges: a foe two or three cells off is reached and struck in one action', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a] = foes; put(p, a!, 7, 4, 999);
  only(p, u); p.s.rng.chance = () => true;
  const ev = tick(p, 0.05);
  expect(Math.max(Math.abs(entOf(p, u.id)!.pos.x - 7), Math.abs(entOf(p, u.id)!.pos.y - 4))).toBe(1);
  expect(ev.some((e) => e.type === 'move' && e.src === u.id && e.text === 'dash')).toBe(true);
  expect(entOf(p, a!.id)!.hp).toBeLessThan(999);
});

it('a foe farther than the charge is walked toward, not leapt at', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a] = foes; put(p, a!, 10, 4, 999);
  only(p, u); const ev = tick(p, 0.05);
  expect(ev.some((e) => e.type === 'move' && e.text === 'dash')).toBe(false); expect(entOf(p, a!.id)!.hp).toBe(999);
});

it('an archer with marking cards goes for the marked foe over a nearer plain one', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; u.gear = undefined; const [a, b] = foes; put(p, a!, 6, 4, 200); put(p, b!, 9, 4, 200);
  u.traits = { multiShot: 1, hunterInstinct: 1 }; applyStatus(p, u, b!, 'mark', 0, []);
  expect(bestTarget(p, u, 0)?.id).toBe(b!.id);
});

it('a mage whose fire kills spread goes for the burning foe in a crowd', () => {
  const { p, u, foes } = scene('mage'); u.weapon = 'staff'; u.gear = undefined; const [a, b, c] = foes; put(p, a!, 6, 3, 200); put(p, b!, 8, 6, 200); put(p, c!, 9, 6, 200);
  u.traits = { fireSpread: 1 }; applyStatus(p, u, b!, 'burn', 0, []);
  expect(bestTarget(p, u, 0)?.id).toBe(b!.id);
});

it('a rogue with vitals goes for the foe carrying the most states', () => {
  const { p, u, foes } = scene('rogue'); u.weapon = 'daggers'; u.gear = undefined; const [a, b] = foes; put(p, a!, 5, 4, 200); put(p, b!, 5, 5, 200);
  u.traits = { vitals: 1 }; applyStatus(p, u, b!, 'poison', 0, []); applyStatus(p, u, b!, 'bleed', 0, []);
  expect(bestTarget(p, u, 0)?.id).toBe(b!.id);
});

it('a foe it can finish off now beats a fresh one', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a, b] = foes; put(p, a!, 5, 4, 200); put(p, b!, 5, 5, 200);
  u.traits = { finish: 1 }; entOf(p, b!.id)!.hp = 3;
  expect(bestTarget(p, u, 0)?.id).toBe(b!.id);
});

it('it keeps hitting the foe it chose unless another is much better', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a, b] = foes; put(p, a!, 5, 4, 200); put(p, b!, 5, 5, 200);
  const first = bestTarget(p, u, 0)!; const other = first === a ? b! : a!;
  entOf(p, other.id)!.hp = 190;
  expect(bestTarget(p, u, 0.5)?.id).toBe(first.id);
});

it('a mage reads its own element cycle: its next element sets off a reaction on the foe that carries the partner', () => {
  const { p, u, foes } = scene('mage'); u.weapon = 'staff'; u.gear = undefined; const [a, b] = foes; put(p, a!, 7, 4, 200); put(p, b!, 7, 6, 200);
  u.traits = {}; u.cycle = 0; applyStatus(p, u, b!, 'chill', 0, []); applyStatus(p, u, a!, 'bleed', 0, []);
  expect(bestTarget(p, u, 0)?.id).toBe(b!.id);
});
