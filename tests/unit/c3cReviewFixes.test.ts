import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action, emit } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import { summon } from '../../src/sim/party/kitEffects';
import { useUltimate } from '../../src/sim/party/ultimate';
import { hammerCells, tickHammers, tickZones } from '../../src/sim/party/cardsCleric';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { classScene } from './support/classScene';
import type { BaseClass } from '../../src/sim/party/partyDefs';

const both = (a: BaseClass, b: BaseClass, traits: Record<string, number>) => {
  const sc = classScene(a); sc.u.souls = [...(sc.u.souls ?? []), { cls: b, ultReady: 0 }]; sc.u.traits = traits; return sc;
};

it('zeal is capped at six turns ahead however many die in the aura', () => {
  const { p, u, put } = classScene('cleric'); u.traits = { purifyAura: 1, zealAura: 2 };
  for (let k = 0; k < 10; k++) { const f = put(k, 5, 6, 1); action(p, () => damage(p, 1, u.id, f, 99, [], true)); }
  expect(u.zealUntil).toBeLessThanOrEqual(7);
});

it('hammer and whirlwind blows are hits: the cleric’s judgment counts the hammer; a whirlwind sets off hit cards', () => {
  const s = classScene('cleric'); s.u.traits = { hammer: 1, judgment: 1 };
  s.put(5, 12, 10);
  const cell = hammerCells(s.p, s.u, 0)[0]!, a = s.put(0, cell.x, cell.y);
  tickHammers(s.p, 0.5, []);
  expect(a.judge).toBe(1);
  const w = classScene('warrior'); w.u.traits = {};
  let hits = 0; w.u.triggers = [{ id: 'spy', when: 'hit', repeat: true, run: () => { hits++; } }];
  w.put(0, 6, 6); w.put(1, 4, 8);
  action(w.p, () => whirlwind(w.p, w.u, 1, []));
  expect(hits).toBe(2);
});

it('extra hammers end when the fight does (they do not ride the lift into the next one)', () => {
  const { p, u } = classScene('cleric'); u.traits = { hammer: 1 }; u.hammers = [999, 999];
  tickHammers(p, 1, []);
  expect(u.hammers ?? []).toEqual([]);
});

it('a sanctuary lasts three turns and ends with its cleric', () => {
  const { p, u, put, hp } = classScene('cleric');
  put(0, 9, 7);
  entOf(p, 'hero')!.pos = { x: 8, y: 6 };
  expect(useUltimate(p, 'hero', { x: 9, y: 6 }, 0).length).toBeGreaterThan(0);
  tickZones(p, p.time + 9, []);
  expect(u.immuneUntil ?? 0).toBeLessThanOrEqual(p.time + 3);
  const s = classScene('cleric'); const f = s.put(0, 9, 7);
  entOf(s.p, 'hero')!.pos = { x: 8, y: 6 };
  useUltimate(s.p, 'hero', { x: 9, y: 6 }, 0);
  entOf(s.p, 'hero')!.alive = false;
  tickZones(s.p, s.p.time + 2, []);
  expect(s.hp(f)).toBe(999); void hp;
});

it('light arrow heals the body itself, not a minion', () => {
  const { p, u, put } = both('archer', 'cleric', { lightArrow: 1 });
  summon(p, u, { x: 4, y: 6 }, 0, [], 2, { hp: 50 });
  const m = p.units[p.units.length - 1]!; entOf(p, m.id)!.hp = 1; entOf(p, 'hero')!.hp = 10;
  const a = put(0, 8, 6); applyStatus(p, u, a, 'mark', 0, []);
  action(p, () => emit(p, 'hit', { t: 1, src: u, target: a, ev: [] }));
  expect(entOf(p, 'hero')!.hp).toBe(14); expect(entOf(p, m.id)!.hp).toBe(1);
});

it('shatter (warrior-mage) needs a melee blow', () => {
  const { p, u, put } = both('warrior', 'mage', { shatterDuo: 1 });
  u.gear!.weapon = { id: 'bow', def: 'longbow', power: 0 }; u.weapon = 'longbow';
  const a = put(0, 8, 6, 5000); a.status.freeze = { until: 9 };
  strike(p, u, a, 1, []);
  expect(a.status.freeze).toBeDefined();
});

it('the volley does not reach sleeping foes or foes behind a wall', () => {
  const { p, u, put, hp } = classScene('archer'); u.traits = { multiShot: 1 }; u.volleyUntil = 9;
  const a = put(0, 8, 6), sleeper = put(1, 5, 8), hidden = put(2, 4, 9);
  sleeper.asleep = true;
  for (let x = 1; x < 20; x++) p.s.map.tiles[8 * p.s.map.w + x] = 'wall';
  entOf(p, sleeper.id)!.pos = { x: 6, y: 7 };
  strike(p, u, a, 1, []);
  expect(hp(sleeper)).toBe(999); expect(hp(hidden)).toBe(999);
});
