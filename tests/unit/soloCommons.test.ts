import { expect, it } from 'vitest';
import { action } from '../../src/sim/party/triggers';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { summon } from '../../src/sim/party/kitEffects';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { tagsOf } from '../../src/sim/party/classKit';
import { classScene } from './support/classScene';

it('bond counts the body’s own minions and clones as allies: ×1.15 for each within two', () => {
  const run = (minion: boolean) => {
    const s = classScene('necromancer'); s.u.traits = { bond: 1 };
    if (minion) summon(s.p, s.u, { x: 4, y: 6 }, 0, [], 2, { hp: 99 });
    const f = s.put(0, 5, 6, 5000); strike(s.p, s.u, f, 1, []); return 5000 - s.hp(f);
  };
  expect(run(true) / run(false)).toBeCloseTo(1.15, 1);
});

it('morale heals the body and its minions', () => {
  const { p, u, put } = classScene('necromancer'); u.traits = { morale: 1 };
  summon(p, u, { x: 4, y: 6 }, 0, [], 2, { hp: 50 });
  const m = p.units[p.units.length - 1]!; entOf(p, m.id)!.hp = 10; entOf(p, 'hero')!.hp = 10;
  const a = put(0, 5, 6, 1);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(entOf(p, m.id)!.hp).toBe(18); expect(entOf(p, 'hero')!.hp).toBe(18);
});

it('cruelty multiplies critical damage ×1.15 per #치명', () => {
  const { u } = classScene('rogue'); u.traits = { cruel: 1, chargeUp: 1, finisher: 1 };
  const n = tagsOf(u).치명 ?? 0;
  expect(1.5 + TRAITS.cruel!.passive!(u, 1).critDmg!).toBeCloseTo(1.5 * 1.15 ** n);
});
