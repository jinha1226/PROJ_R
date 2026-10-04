import { expect, it } from 'vitest';
import { gunRelay, onStunned, otherHand, withOtherHand } from '../../../src/sim/grid/kata';
import { meleeAttack, rangedAttack } from '../../../src/sim/grid/weapons';
import { defend } from '../../../src/sim/grid/defense';
import { counterBlow } from '../../../src/sim/grid/combos';
import { makeWeapon } from '../../../src/sim/grid/items';
import { idx } from '../../../src/sim/grid/types';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { OPEN, sim, sureHits } from './kit';
const hooks = { noise: () => {}, cast: () => 1 };

it('restores both nested hand switches when a callback throws or the hero dies', () => {
  const g = sim(OPEN, { x: 5, y: 7 });
  expect(otherHand(g.s)?.group).toBe('dagger');
  expect(() => withOtherHand(g.s, () => withOtherHand(g.s, () => { throw new Error('hook'); }))).toThrow('hook');
  expect(g.s.hero.gear.active).toBe(0);
  expect(withOtherHand(g.s, () => { g.s.hero.alive = false; return 7; })).toBe(7);
  expect(g.s.hero.gear.active).toBe(0);
  g.s.hero.gear.hands[1] = null;
  expect(otherHand(g.s)).toBeNull();
});
it('relay picks the lowest id at equal range regardless of foe array order', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 5, y: 4 } }, { kind: 'brute', pos: { x: 8, y: 7 } }]);
  sureHits(g);
  g.s.hero.suit = ['gunRelay']; g.s.hero.gear.active = 1;
  g.s.foes.reverse();
  g.s.events.push({ t: 0, type: 'die', src: 'hero', dst: 'gone' });
  gunRelay(g.s, 0, 0, hooks);
  expect(g.s.events.find(e => e.type === 'shoot')?.dst).toBe('f1');
});
it.each(['charge', 'range', 'wall', 'dead'] as const)('counterShot refuses %s without spending charge', reason => {
  const g = sim(OPEN, { x: 2, y: 7 }, [{ kind: 'archer', pos: { x: reason === 'range' ? 13 : 6, y: 7 } }]);
  sureHits(g); g.s.hero.suit = ['counterShot'];
  g.s.hero.gear.hands[0] = makeWeapon('rifle', 1);
  if (reason === 'charge') g.s.hero.charge = 1;
  if (reason === 'wall') g.s.map.tiles[idx(g.s.map, { x: 4, y: 7 })] = 'wall';
  if (reason === 'dead') g.s.foes[0]!.alive = false;
  const before = g.s.hero.charge;
  defend(g.s, 0, 'f1', 'shot');
  expect(g.s.events.some(e => e.text === 'counterShot')).toBe(false);
  expect(g.s.hero.charge).toBe(before);
});
it('a missed riposte does not stun or execute', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
  g.s.hero.suit = ['riposte', 'execute'];
  g.s.hero.gear.hands[1] = makeWeapon('sword', 1); g.s.hero.gear.active = 1;
  g.s.rng.chance = () => false;
  counterBlow(g.s, 0, 'f1', 'parry');
  expect(g.s.events.some(e => e.type === 'stun' || e.text === 'execute')).toBe(false);
});
it('execute refuses distant, dead, unarmed, or uncharged targets and fires only once', () => {
  for (const reason of ['far', 'dead', 'noGun', 'empty', 'repeat']) {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'champion', pos: { x: reason === 'far' ? 7 : 6, y: 7 } }]);
    g.s.hero.suit = ['execute'];
    if (reason === 'dead') g.s.foes[0]!.alive = false;
    if (reason === 'noGun') g.s.hero.gear.hands[0] = null;
    if (reason === 'empty') g.s.hero.charge = 0;
    onStunned(g.s, 0, g.s.foes[0]!); onStunned(g.s, 0, g.s.foes[0]!);
    expect(g.s.events.filter(e => e.type === 'shoot')).toHaveLength(reason === 'repeat' ? 1 : 0);
  }
});
it('blade relay stops on a lethal landing trap and restores the gun', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 5, y: 4 } }, { kind: 'brute', pos: { x: 7, y: 7 } }]);
  sureHits(g); g.s.hero.suit = ['bladeRelay']; g.s.hero.hp = 1; g.s.foes[0]!.hp = 1;
  g.s.traps.push({ pos: { x: 6, y: 7 }, kind: 'spike', found: false });
  rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  expect(g.s.hero.alive).toBe(false);
  expect(g.s.hero.gear.active).toBe(0);
  expect(g.s.foes[1]!.hp).toBe(g.s.foes[1]!.maxHp);
});
it('spin shots also work on a gun bash and cannot pass through diagonal corners', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }, { kind: 'minion', pos: { x: 5, y: 6 } }, { kind: 'minion', pos: { x: 4, y: 8 } }]);
  sureHits(g); g.s.hero.suit = ['spinShot'];
  g.s.map.tiles[idx(g.s.map, { x: 4, y: 7 })] = 'wall';
  g.s.foes.forEach(f => { f.hp = 1; });
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);
  expect(g.s.foes.map(f => f.alive)).toEqual([false, false, true]);
  expect(g.s.events.find(e => e.type === 'bump')?.group).toBe('pistol');
});
it('old saved runs fill free=false and retain their existing hands', () => {
  const g = sim(OPEN, { x: 5, y: 7 });
  g.s.hero.gear.hands[1] = null;
  const data = JSON.parse(toSave(g.s));
  delete data.state.hero.fx.free;
  const loaded = fromSave(JSON.stringify(data))!;
  expect(loaded.hero.fx.free).toBe(false);
  expect(loaded.hero.gear.hands[1]).toBeNull();
});
it('a slam execution spending the last charge does not fire shoveShot', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'champion', pos: { x: 6, y: 7 } }]);
  sureHits(g);
  g.s.hero.gear.hands[1] = makeWeapon('sword', 1); g.s.hero.gear.active = 1;
  g.s.hero.suit = ['shoveShot', 'execute']; g.s.hero.maxCharge = g.s.hero.charge = 1;
  g.s.map.tiles[idx(g.s.map, { x: 7, y: 7 })] = 'wall';
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);
  expect(g.s.events.some(e => e.text === 'execute')).toBe(true);
  expect(g.s.events.some(e => e.text === 'shoveShot')).toBe(false);
  expect(g.s.hero.charge).toBe(0);
  expect(g.s.hero.gear.active).toBe(1);
});
it('spin kills can trigger gunRelay when the main blow did not kill', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'champion', pos: { x: 6, y: 7 } }, { kind: 'minion', pos: { x: 5, y: 6 } }]);
  sureHits(g); g.s.hero.gear.active = 1; g.s.hero.suit = ['spinShot', 'gunRelay'];
  g.s.foes[1]!.hp = 1;
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);
  expect(g.s.events.filter(e => e.type === 'engrave').map(e => e.text)).toEqual(['spinShot', 'gunRelay']);
  expect(g.s.hero.charge).toBe(8);
});
