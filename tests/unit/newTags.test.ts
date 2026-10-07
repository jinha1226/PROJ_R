import { afterEach, expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { LAW_TEXT, resonant } from '../../src/sim/party/resonance';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { card, type Tag } from '../../src/sim/party/traitTypes';
import { action, emit } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';

const added: string[] = [];
/** three test cards of a tag, so a clone can light its resonance */
const give = (u: ReturnType<typeof unitOf> & object, tag: Tag) => {
  for (let i = 0; i < 3; i++) { const id = `zz-${tag}-${i}`; TRAITS[id] = card(id, id, 'amp', [tag], 'common', '', {}); added.push(id); u.traits = { ...u.traits, [id]: 1 }; }
};
afterEach(() => { for (const id of added.splice(0)) delete TRAITS[id]; });

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  for (const f of p.units) if (f.side === 'foe') { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!;
  fe.alive = true; fe.hp = fe.maxHp = 999; foe.asleep = false; foe.reaped = false; foe.nextAt = 999;
  return { p, u, foe };
};

it('five new tags, each with two laws', () => {
  for (const tag of ['뼈', '함정', '함성', '오라', '신성'] as Tag[]) expect(LAW_TEXT[tag]).toHaveLength(2);
});

it('the empty body resonates like any class', () => {
  const { p, u } = scene();
  u.traits = { pierceRound: 1, pointBlank: 1, returnFire: 1 };
  expect(resonant(p, u, '원거리', 1)).toBe(true);
});

it('three #뼈: a bone-shard shield at the start of a fight', () => {
  const { p, u } = scene(); give(u, '뼈'); u.shield = 0;
  action(p, () => emit(p, 'combatStart', { t: 0, src: u, ev: [] }));
  expect(u.shield).toBeGreaterThanOrEqual(6);
});

it('three #신성: holy damage dealt heals two', () => {
  const { p, u, foe } = scene(); give(u, '신성');
  const e = entOf(p, 'hero')!; e.hp = e.maxHp - 10;
  action(p, () => damage(p, 0, u.id, foe, 5, [], true, false, 'holy'));
  expect(e.hp).toBe(e.maxHp - 8);
});

it('three #함성: a stun this clone lays lasts a turn longer', () => {
  const a = scene(), b = scene(); give(b.u, '함성');
  applyStatus(a.p, a.u, a.foe, 'stun', 0, []); applyStatus(b.p, b.u, b.foe, 'stun', 0, []);
  expect(b.foe.status.stun!.until - a.foe.status.stun!.until).toBe(1);
});
