import { expect, it } from 'vitest';
import { emit } from '../../../src/sim/grid/kataBus';
import { runEffect } from '../../../src/sim/grid/kataEffects';
import { ENGRAVES, type EngraveId } from '../../../src/sim/grid/engraveCore';
import { DEFS } from '../../../src/sim/grid/engraveDefs';
import { makeWeapon } from '../../../src/sim/grid/items';
import { meleeAttack, rangedAttack } from '../../../src/sim/grid/weapons';
import { idx } from '../../../src/sim/grid/types';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { OPEN, sim, sureHits } from './kit';
const hooks = { noise: () => {} };
const setup = () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }, { kind: 'brute', pos: { x: 5, y: 6 } }]);
  sureHits(g); g.s.hero.suit = []; return g;
};
const ids: EngraveId[] = ['bloodlust', 'fury', 'shoulder', 'ironwall', 'cull', 'tempest', 'gale', 'rebound',
  'quickdraw', 'pierce', 'sniper', 'headshot', 'covering', 'suppress', 'barrage', 'thrift', 'steady',
  'bayonet', 'reverseCut', 'reclaim', 'muzzleShove', 'executionRush', 'trance'];
it.each(ids)('%s has a priced unlock and cannot fire with an incompatible loadout', id => {
  const { s } = setup(); s.hero.suit = [id]; s.hero.gear.hands = [null, null]; s.hero.hp -= 5; s.hero.charge = 0;
  const def = ENGRAVES[id]; expect(def.base).toBe(true); expect(def.cost).toBeGreaterThan(0);
  expect(def.tags.length).toBeGreaterThan(0); expect(def.note).toContain(' → ');
  emit(s, DEFS[id]!.on, { t: 0, foe: s.foes[0], count: 2, src: 'slam' });
  expect(s.fired.size).toBe(0);
});
it('delay has a no-op contract for a missing, dead or hero target', () => {
  const { s } = setup(); const before = JSON.stringify(s);
  expect(runEffect(s, 'delay', { t: 0 }, 0.5)).toBe(false);
  expect(runEffect(s, 'delay', { t: 0, foe: s.hero }, 0.5)).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
  s.foes[0]!.alive = false;
  expect(runEffect(s, 'delay', { t: 0, foe: s.foes[0] }, 0.5)).toBe(false);
});
it('bayonet and reverseCut ping-pong fires each once, with one extra shot and slash', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.suit = ['bayonet', 'reverseCut'];
  s.foes[0]!.hp = s.foes[0]!.maxHp = 100; s.hero.charge = 5;
  meleeAttack(s, 0, { x: 1, y: 0 }, s.foes[0]!, hooks);
  expect(s.events.filter(e => e.type === 'engrave').map(e => e.text)).toEqual(['bayonet', 'reverseCut']);
  expect(s.events.filter(e => e.type === 'shoot')).toHaveLength(1);
  expect(s.events.filter(e => e.type === 'hit')).toHaveLength(3);
  expect(s.hero.gear.active).toBe(1);
});
it('tempest with an axe still strikes each neighbour only once in its effect', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.gear.hands[1] = makeWeapon('axe', 1); s.hero.suit = ['tempest'];
  s.foes.forEach(f => { f.hp = f.maxHp = 100; });
  emit(s, 'surrounded', { t: 0 });
  expect(s.events.filter(e => e.type === 'hit')).toHaveLength(2);
  emit(s, 'surrounded', { t: 0 }); expect(s.events.filter(e => e.type === 'hit')).toHaveLength(2);
});
it('nested gun kills do not count as melee kills for gale or trance', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.hp -= 5;
  s.hero.suit = ['spinShot', 'gale', 'bloodlust', 'trance']; s.foes[1]!.hp = 1;
  meleeAttack(s, 0, { x: 1, y: 0 }, s.foes[0]!, hooks); emit(s, 'chain', { t: 0 });
  expect(s.hero.fx.kills).toEqual({ melee: [], gun: [s.foes[1]!.id] });
  expect([...s.fired]).toEqual(['spinShot']); expect(s.hero.hp).toBe(s.hero.maxHp - 5);
});
it('gale counts two nested melee kills, and trance sees both real attack kinds', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.hp -= 5;
  s.hero.suit = ['tempest', 'gale', 'trance']; s.foes.forEach(f => { f.hp = 1; });
  meleeAttack(s, 0, { x: 1, y: 0 }, s.foes[0]!, hooks);
  expect(s.hero.fx.kills?.melee).toHaveLength(2); expect(s.fired.has('gale')).toBe(true);
  const g = setup(); g.s.hero.gear.active = 1; g.s.hero.hp -= 5;
  g.s.hero.suit = ['gunRelay', 'trance']; g.s.foes.forEach(f => { f.hp = 1; });
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks); emit(g.s, 'chain', { t: 0 });
  expect(g.s.hero.fx.kills?.melee).toHaveLength(1); expect(g.s.hero.fx.kills?.gun).toHaveLength(1);
  expect(g.s.hero.hp).toBe(g.s.hero.maxHp - 2);
});
it('barrage rejects hidden, blocked and out-of-range foes, and cannot overspend', () => {
  for (const reason of ['hidden', 'blocked', 'range'] as const) {
    const { s } = setup(); s.hero.suit = ['barrage']; s.hero.arrows = 1;
    if (reason === 'hidden') s.visible.clear();
    if (reason === 'blocked') s.foes.forEach(f => { s.map.tiles[idx(s.map, f.pos)] = 'wall'; f.pos.x += 2; });
    if (reason === 'range') s.foes.forEach(f => { f.pos.x = 14; });
    emit(s, 'chain', { t: 0 });
    expect(s.fired.size).toBe(0); expect(s.hero.arrows).toBe(1);
  }
  const { s } = setup(); s.hero.suit = ['barrage']; s.hero.arrows = 1;
  emit(s, 'chain', { t: 0 }); expect(s.events.filter(e => e.type === 'shoot')).toHaveLength(1); expect(s.hero.arrows).toBe(0);
});
it('pierce cannot refund its free shot through the parent attack', () => {
  const { s } = setup(); s.hero.gear.hands[0] = makeWeapon('staff', 1); s.hero.suit = ['pierce', 'thrift']; s.hero.charge = 2;
  s.foes[1]!.pos = { x: 7, y: 7 }; s.foes[1]!.hp = 1;
  rangedAttack(s, 0, s.foes[0]!, hooks);
  expect(s.fired.has('pierce')).toBe(true); expect(s.fired.has('thrift')).toBe(false); expect(s.hero.charge).toBe(0);
});
it('preShot runs only for valid attacks, consumes boosts even on misses and uses max, not product', () => {
  const g = setup(), { s } = g; s.hero.suit = ['sniper', 'headshot', 'steady']; const foe = s.foes[0]!;
  foe.pos = { x: 9, y: 7 }; s.hero.fx.lastAction = 'wait'; s.hero.arrows = 0;
  expect(rangedAttack(s, 0, foe, hooks)).toBeNull(); expect(s.fired.size).toBe(0);
  s.hero.arrows = 1; s.rng.chance = () => false;
  rangedAttack(s, 0, foe, hooks);
  expect([...s.fired]).toEqual(['sniper', 'headshot']); expect(s.hero.fx.nextMult).toBe(1);
  expect(s.events.some(e => e.type === 'miss')).toBe(true);
});
it('last action tracks completed moves and waits, survives saves, ignores blocked actions and card choices', () => {
  const g = sim(OPEN, { x: 5, y: 7 }); sureHits(g); g.s.hero.suit = [];
  g.act({ kind: 'wait' }); expect(g.s.hero.fx.lastAction).toBe('wait');
  g.act({ kind: 'shoot', target: 'missing' }); expect(g.s.hero.fx.lastAction).toBe('wait');
  g.s.offers = [['steady']]; g.act({ kind: 'choose', i: 0 }); expect(g.s.hero.fx.lastAction).toBe('wait');
  g.act({ kind: 'move', dir: { x: 1, y: 0 }, plain: true }); expect(g.s.hero.fx.lastAction).toBe('move');
  expect(fromSave(toSave(g.s)).hero.fx.lastAction).toBe('move');
  g.act({ kind: 'swap' }); expect(g.s.hero.fx.lastAction).toBe('other');
  expect(g.s.hero.fx.kills).toEqual({ melee: [], gun: [] });
});

it('cull applies to a landed spear hit at reach and rejects foes above the threshold', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.gear.hands[1] = makeWeapon('spear', 1); s.hero.suit = ['cull'];
  const foe = s.foes[0]!; foe.pos.x = 7; foe.hp = foe.maxHp = 100;
  emit(s, 'meleeHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.hp = 30; meleeAttack(s, 0, { x: 1, y: 0 }, foe, hooks);
  expect(foe.alive).toBe(false); expect(s.fired.has('cull')).toBe(true);
});
it('fury from a leap kill remains banked for the next attack', async () => {
  const { lunge } = await import('../../../src/sim/grid/combos');
  const { s } = setup(); s.hero.gear.active = 1; s.hero.suit = ['leap', 'fury'];
  s.foes[0]!.pos = { x: 8, y: 7 }; s.foes[0]!.hp = 1; s.foes[1]!.alive = false;
  lunge(s, 0, { x: 1, y: 0 }, hooks);
  expect(s.fired.has('fury')).toBe(true); expect(s.hero.fx.nextMult).toBe(1.5);
});

it('covering survives movement and waiting, then makes the next valid shot free', () => {
  const g = setup(), { s } = g; s.hero.suit = ['covering']; s.foes.forEach(f => { f.nextAt = 100; });
  emit(s, 'dodge', { t: 0 });
  let before = s.hero.nextAt; g.act({ kind: 'move', dir: { x: -1, y: 0 }, plain: true });
  expect(s.hero.nextAt).toBeGreaterThan(before); expect(s.hero.fx.freeShot).toBe(true);
  before = s.hero.nextAt; g.act({ kind: 'wait' }); expect(s.hero.nextAt).toBeGreaterThan(before);
  before = s.hero.nextAt; g.act({ kind: 'shoot', target: 'missing' }); expect(s.hero.fx.freeShot).toBe(true);
  g.act({ kind: 'shoot', target: s.foes[0]!.id });
  expect(s.hero.nextAt).toBe(before); expect(s.hero.fx.freeShot).toBe(false);
});
it('a counter consumes fury on the next blade hit instead of retaining the multiplier', async () => {
  const { counterBlow } = await import('../../../src/sim/grid/combos');
  const { s } = setup(); s.hero.gear.active = 1; s.hero.suit = ['counter']; s.hero.fx.nextMult = 1.5;
  counterBlow(s, 0, s.foes[0]!.id, 'dodge'); expect(s.hero.fx.nextMult).toBe(1);
});
