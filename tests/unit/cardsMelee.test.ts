import { expect, it } from 'vitest';
import { damage, entOf, strike, targetOf } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { action, emit } from '../../src/sim/party/triggers';
import { MELEE_CARDS } from '../../src/sim/party/cardsMelee';
import { scene, put } from './support/cardScene';

it('eight warrior cards (the rogue moved to its branches)', () => {
  expect(MELEE_CARDS.filter((d) => d.pool === 'warrior')).toHaveLength(8);
  expect(MELEE_CARDS.filter((d) => d.pool === 'rogue')).toHaveLength(0);
});

it('a foe near a warrior goes for the warrior', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 6, 4);
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; entOf(p, other.id)!.alive = true; other.cls = 'archer'; entOf(p, other.id)!.pos = { x: 7, y: 4 };
  expect(targetOf(p, a!, 0)?.id).toBe(u.id);
});

it('thorns send back half a melee blow', () => {
  const { p, u, foes } = scene('warrior'); u.weapon = 'greataxe'; u.gear = undefined; const [a] = foes; put(p, a!, 5, 4);
  u.traits = { thorns: 1 };
  damage(p, 0, a!.id, u, 20, [], false, false, 'physical', true);
  expect(entOf(p, a!.id)!.hp).toBe(190);
});

it('rage builds with each blow taken and spends itself on the next strike', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { rage: 1 };
  for (let i = 0; i < 3; i++) damage(p, i, a!.id, u, 1, [], false, false, 'physical', true);
  expect(u.rage).toBe(3);
  p.s.rng.chance = () => true; strike(p, u, a!, 5, []); expect(u.rage).toBe(0);
});

it('battle cry taunts the foes round at the start of a fight', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 6, 5);
  u.traits = { battleCry: 1 };
  action(p, () => emit(p, 'combatStart', { t: 0, src: u, ev: [] }));
  expect(a!.tauntBy).toBe(u.id); expect(a!.tauntUntil).toBe(2);
});

it('vitals: each state on the foe adds a quarter', () => {
  const run = (states: boolean) => {
    const { p, u, foes } = scene('rogue'); u.weapon = 'daggers'; u.gear = undefined; const [a] = foes; put(p, a!, 5, 4, 999);
    if (states) { applyStatus(p, u, a!, 'poison', 0, []); applyStatus(p, u, a!, 'bleed', 0, []); }
    u.traits = { vitals: 1 }; p.s.rng.chance = () => true; p.s.rng.int = () => 10; a!.order = { kind: 'attack', target: u.id };
    strike(p, u, a!, 0.1, []); return 999 - entOf(p, a!.id)!.hp;
  };
  expect(run(true)).toBeGreaterThan(run(false));
});

