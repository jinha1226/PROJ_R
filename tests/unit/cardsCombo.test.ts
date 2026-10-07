import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { duoActive, COMBO_CARDS } from '../../src/sim/party/cardsCombo';
import { action, emit } from '../../src/sim/party/triggers';
import { scene, put } from './support/cardScene';
import { classScene } from './support/classScene';
import type { GEvent } from '../../src/sim/grid/types';
import { strike } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { whirlwind } from '../../src/sim/party/cardsWarrior';
import { laySnare, tickSnares } from '../../src/sim/party/snares';
import { BASE_CLASSES, type BaseClass } from '../../src/sim/party/partyDefs';

const ally = (p: ReturnType<typeof scene>['p'], u: ReturnType<typeof scene>['u'], cls: 'archer' | 'warrior' | 'cleric' | 'mage' | 'rogue', x = 1, y = 1) => {
  const o = p.units.find((v) => v.side === 'hero' && v !== u && !entOf(p, v.id)!.alive)!; o.cls = cls; o.souls = [{ cls, ultReady: 0 }]; o.traits = {}; entOf(p, o.id)!.alive = true; entOf(p, o.id)!.pos = { x, y }; return o;
};

it('a duo works only in a body holding both classes', () => {
  const { u } = scene('warrior');
  u.traits = { bait: 1 };
  expect(duoActive(u, 'bait')).toBe(false);
  u.souls = [...(u.souls ?? []), { cls: 'archer', ultReady: 0 }];
  expect(duoActive(u, 'bait')).toBe(true);
});

it('bait: a foe that hits a warrior-archer body is marked', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4); u.souls = [...(u.souls ?? []), { cls: 'archer', ultReady: 0 }];
  u.traits = { bait: 1 }; damage(p, 0, a!.id, u, 5, [], false, false, 'physical', true);
  expect((a!.status.mark?.until ?? 0) > 0).toBe(true);
});

it('blood feast: hitting a bleeding foe heals the most hurt ally (a rogue-cleric body)', () => {
  const { p, u, foes } = scene('rogue'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.souls = [...u.souls!, { cls: 'cleric', ultReady: 0 }];
  u.traits = { bloodFeast: 1 }; const ce = entOf(p, u.id)!; ce.hp = 10;
  a!.status.bleed = { until: 9, by: u.id, stacks: 1 };
  action(p, () => emit(p, 'hit', { t: 0, src: u, target: a, ev: [] }));
  expect(ce.hp).toBe(13);
});

it('martyr: when a clone falls the rest heal and hit harder', () => {
  const { p, u, foes } = scene('cleric'); const [a] = foes; put(p, a!, 5, 4); const o = ally(p, u, 'warrior');
  u.traits = { martyr: 1 }; const e = entOf(p, u.id)!; e.hp = 10;
  damage(p, 0, a!.id, o, 9999, []);
  expect(e.hp).toBe(10 + Math.round(e.maxHp * 0.3)); expect(u.damageBuff).toBe(1.3);
});

const both = (a: BaseClass, b: BaseClass, traits: Record<string, number>) => {
  const sc = classScene(a); sc.u.souls = [...(sc.u.souls ?? []), { cls: b, ultReady: 0 }]; sc.u.traits = traits; return sc;
};

it('fifteen combos, one for each pair of the six soul classes', () => {
  const combos = COMBO_CARDS.filter((d) => d.pool === 'duo');
  expect(combos).toHaveLength(15);
  const pairs = combos.map((d) => [...d.duo!].sort().join('+'));
  expect(new Set(pairs).size).toBe(15);
  for (let i = 0; i < BASE_CLASSES.length; i++) for (let j = i + 1; j < BASE_CLASSES.length; j++) expect(pairs).toContain([BASE_CLASSES[i]!, BASE_CLASSES[j]!].sort().join('+'));
});

it('blood offering: a foe the whirlwind kills bursts at once', () => {
  const { p, u, put, hp } = both('warrior', 'necromancer', { bloodOffering: 1 });
  const weak = put(0, 6, 6, 1), b = put(1, 7, 6);
  action(p, () => whirlwind(p, u, 1, []));
  expect(entOf(p, weak.id)!.alive).toBe(false); expect(weak.raised).toBe(true); expect(hp(b)).toBeLessThan(999);
});

it('element trap: a snare going off lays the element cycle’s next element', () => {
  const { p, u, put } = both('rogue', 'mage', { elemTrap: 1 }); u.cycle = 0;
  const a = put(0, 9, 9);
  // the snare's shock meets the cycle's burn: an overload
  const ev: GEvent[] = [];
  laySnare(p, u, { x: 9, y: 9 }, 'bolt', 0, []); tickSnares(p, 1, ev);
  expect(ev.some((e) => e.type === 'react' && e.dst === a.id)).toBe(true);
});

it('ice corpse: a frozen foe dying freezes the foes beside it', () => {
  const { p, u, put } = both('mage', 'necromancer', { iceCorpse: 1 });
  const a = put(0, 8, 6, 1), b = put(1, 9, 6); a.status.freeze = { until: 9 };
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect((b.status.freeze?.until ?? 0) > 1).toBe(true);
});

it('bone arrow: a bone spear through a marked foe throws another from it', () => {
  const { p, u, put, hp } = both('necromancer', 'archer', { boneSpear: 1, boneArrow: 1 });
  const a = put(0, 7, 6), b = put(1, 9, 6), c = put(2, 10, 9);
  applyStatus(p, u, b, 'mark', 0, []);
  strike(p, u, a, 0, []);
  expect(hp(c)).toBeLessThan(999);
});

it('life cycle: each corpse explosion shields the body', () => {
  const { p, u, put } = both('necromancer', 'cleric', { lifeCycle: 1 }); u.shield = 0;
  const a = put(0, 9, 6, 10); put(1, 10, 6);
  p.s.rng.chance = () => false;
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(u.shield).toBe(3);
});

it('poison trap: a snare going off beside a body leaves a poison cloud', () => {
  const { p, u, put } = both('rogue', 'necromancer', { poisonTrap: 1 });
  const dead = put(1, 10, 9, 1); entOf(p, dead.id)!.alive = false; dead.raised = false;
  put(0, 9, 9);
  laySnare(p, u, { x: 9, y: 9 }, 'bolt', 0, []); tickSnares(p, 1, []);
  expect(p.grounds?.some((g) => g.kind === 'poison' && g.by === u.id)).toBe(true);
});

it('a combo held without its second soul does nothing', () => {
  const { p, u, put } = classScene('mage'); u.traits = { iceCorpse: 1 };
  const a = put(0, 8, 6, 1), b = put(1, 9, 6); a.status.freeze = { until: 9 };
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(b.status.freeze).toBeUndefined();
});
