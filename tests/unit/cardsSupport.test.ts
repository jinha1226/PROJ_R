import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { duoActive, SUPPORT_CARDS } from '../../src/sim/party/cardsSupport';
import { action, emit } from '../../src/sim/party/triggers';
import { heal } from '../../src/sim/party/kitEffects';
import { scene, put } from './support/cardScene';

const ally = (p: ReturnType<typeof scene>['p'], u: ReturnType<typeof scene>['u'], cls: 'archer' | 'warrior' | 'cleric' | 'mage' | 'rogue', x = 1, y = 1) => {
  const o = p.units.find((v) => v.side === 'hero' && v !== u && !entOf(p, v.id)!.alive)!; o.cls = cls; o.souls = [{ cls, ultReady: 0 }]; o.traits = {}; entOf(p, o.id)!.alive = true; entOf(p, o.id)!.pos = { x, y }; return o;
};

it('ten duos (the cleric moved to its branches), each naming two classes and who runs it', () => {
  expect(SUPPORT_CARDS.filter((d) => d.pool === 'cleric')).toHaveLength(0);
  const duos = SUPPORT_CARDS.filter((d) => d.pool === 'duo');
  expect(duos).toHaveLength(10); expect(duos.every((d) => d.duo?.length === 2 && !!d.who && d.kind === 'duo')).toBe(true);
});

it('shield burst: an ally\'s broken shield hurts the foes beside it', () => {
  const { p, u, foes } = scene('cleric'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { shieldBurst: 1 }; u.shield = 12;
  damage(p, 0, a!.id, u, 20, [], false, false, 'physical', true);
  expect(entOf(p, a!.id)!.hp).toBe(188);
});

it('judgment: the fifth mark bursts', () => {
  const { p, u, foes } = scene('cleric'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { judgment: 1 }; a!.judge = 4;
  action(p, () => emit(p, 'hit', { t: 0, src: u, target: a, ev: [] }));
  expect(a!.judge).toBe(0); expect((a!.status.stun?.until ?? 0) > 0).toBe(true); expect(entOf(p, a!.id)!.hp).toBe(979);
});

it('overflow grace: healing past full becomes twice as much shield', () => {
  const { p, u } = scene('cleric'); u.traits = { overflowGrace: 1 }; u.shield = 0;
  const e = entOf(p, u.id)!; e.hp = e.maxHp - 2;
  heal(p, u, u, 7, 0, []);
  expect(u.shield).toBe(10);
});

it('a duo works only in a body holding both classes', () => {
  const { u } = scene('warrior');
  u.traits = { bait: 1 };
  expect(duoActive(u, 'bait')).toBe(false);
  u.souls = [...(u.souls ?? []), { cls: 'archer', ultReady: 0 }];
  expect(duoActive(u, 'bait')).toBe(true);
});

it('bait: a foe that hits the warrior is marked (archer alive)', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4); ally(p, u, 'archer');
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
