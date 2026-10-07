import { expect, it } from 'vitest';
import { resonant, tagCount, LAW_TEXT } from '../../src/sim/party/resonance';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { card } from '../../src/sim/party/traitTypes';
import { applyStatus } from '../../src/sim/party/status';
import { damage, entOf, stats } from '../../src/sim/party/partyCore';
import type { Tag } from '../../src/sim/party/traitTypes';
import { scene, put } from './support/cardScene';

const of = (tag: Tag, n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => { const id = `r_${tag}${i}`; TRAITS[id] = card(id, id, 'amp', [tag], 'common', 't', {}); return [id, 1]; }));

it('three fire cards light the first fire law, six the second; an empty body gets none', () => {
  const { p, u } = scene('mage'); u.gear = undefined;
  u.traits = of('화염', 3);
  expect(tagCount(p, u).화염).toBe(3); expect(resonant(p, u, '화염', 1)).toBe(true); expect(resonant(p, u, '화염', 2)).toBe(false);
  u.traits = of('화염', 6); expect(resonant(p, u, '화염', 2)).toBe(true);
  u.cls = 'shell'; expect(resonant(p, u, '화염', 1)).toBe(false);
  expect(LAW_TEXT.화염[0].length).toBeGreaterThan(4);
});

it('fire 3: a burning foe that dies sets its neighbours alight', () => {
  const { p, u, foes } = scene('mage'); u.gear = undefined; u.traits = of('화염', 3);
  const [a, b] = foes; put(p, a!, 6, 4, 5); put(p, b!, 7, 4);
  const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev);
  damage(p, 0, u.id, a!, 99, ev);
  expect((b!.status.burn?.until ?? 0) > 0).toBe(true);
});

it('fire 6: burns stack', () => {
  const { p, u, foes } = scene('mage'); u.gear = undefined; u.traits = of('화염', 6);
  const [a] = foes; put(p, a!, 6, 4); const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev); applyStatus(p, u, a!, 'burn', 0, ev);
  expect(a!.status.burn?.stacks).toBe(2);
});

it('ranged 3 reaches a cell further; poison 3 lets poison stack to eight', () => {
  const { p, u, foes } = scene('archer'); u.gear = undefined; u.weapon = 'longbow';
  const base = stats(u, 0, p).range; u.traits = { ...of('원거리', 3), ...of('독', 3) };
  expect(stats(u, 0, p).range).toBe(base + 1);
  const [a] = foes; put(p, a!, 6, 4); applyStatus(p, u, a!, 'poison', 0, [], 9);
  expect(a!.status.poison?.stacks).toBe(8);
});

it('survival 3: entering crisis gives a shield of a fifth of max health', () => {
  const { p, u, foes } = scene('warrior'); u.gear = undefined; u.traits = of('생존', 3);
  const [a] = foes; put(p, a!, 5, 4); const e = entOf(p, u.id)!; u.shield = 0;
  u.weapon = 'greataxe'; damage(p, 0, a!.id, u, Math.ceil(e.maxHp * 0.6), []);
  expect(u.shield).toBe(Math.round(e.maxHp * 0.2));
});

it('teamwork counts across the party', () => {
  const { p, u } = scene('warrior');
  const tw = of('협공', 1);
  const others = p.units.filter((x) => x.side === 'hero' && x !== u);
  for (const h of others) { entOf(p, h.id)!.alive = true; h.cls = 'archer'; h.traits = tw; }
  u.traits = tw;
  expect(tagCount(p, u).협공).toBe(3); expect(resonant(p, u, '협공', 1)).toBe(true);
});
