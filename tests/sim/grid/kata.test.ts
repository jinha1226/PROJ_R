import { expect, it } from 'vitest';
import { meleeAttack, pushFoe, rangedAttack } from '../../../src/sim/grid/weapons';
import { counterBlow, lunge } from '../../../src/sim/grid/combos';
import { defend } from '../../../src/sim/grid/defense';
import { makeWeapon } from '../../../src/sim/grid/items';
import { idx, type FoeKind } from '../../../src/sim/grid/types';
import { type EngraveId } from '../../../src/sim/grid/engraveCore';
import { OPEN, sim, sureHits } from './kit';

const hooks = { noise: () => {} };
function setup(ids: EngraveId[], positions: [number, number, FoeKind?][]) {
  const g = sim(OPEN, { x: 5, y: 7 }, positions.map(([x, y, kind]) => ({ kind: kind ?? 'minion', pos: { x, y } })));
  sureHits(g);
  g.s.hero.suit = ids;
  g.s.foes.forEach(f => { f.nextAt = 100; });
  return g;
}
const fired = (g: ReturnType<typeof setup>, id: string) => g.s.events.filter(e => e.type === 'engrave' && e.text === id);
const swing = (g: ReturnType<typeof setup>) => meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);

it('gunRelay shoots a kill follow-up once and restores the dagger', () => {
  const g = setup(['gunRelay'], [[6, 7], [8, 7]]);
  g.s.hero.gear.active = 1;
  g.s.foes.forEach(f => { f.hp = 1; });
  swing(g);
  expect(g.s.foes.every(f => !f.alive)).toBe(true);
  expect(fired(g, 'gunRelay')).toHaveLength(1);
  expect(g.s.hero.arrows).toBe(23);
  expect(g.s.hero.gear.active).toBe(1);
  expect(g.s.events.find(e => e.type === 'bump')?.group).toBe('dagger');
  expect(g.s.events.find(e => e.type === 'shoot')?.group).toBe('bow');
});
it.each(['empty', 'noGun', 'noHooks'] as const)('gunRelay refuses %s', reason => {
  const g = setup(['gunRelay'], [[6, 7], [8, 7]]);
  g.s.hero.gear.active = 1;
  g.s.foes[0]!.hp = 1;
  if (reason === 'empty') g.s.hero.arrows = 0;
  if (reason === 'noGun') g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, reason === 'noHooks' ? undefined : hooks);
  expect(g.s.foes[1]!.hp).toBe(g.s.foes[1]!.maxHp);
  expect(fired(g, 'gunRelay')).toHaveLength(0);
});
it.each(['open', 'wall', 'stairs', 'spear', 'unseen'] as const)('bladeRelay respects %s', obstacle => {
  const g = setup(['bladeRelay'], [[5, 3], [7, 7, 'brute']]);
  g.s.foes[0]!.hp = 1;
  if (obstacle === 'wall') g.s.map.tiles[idx(g.s.map, { x: 6, y: 7 })] = 'wall';
  if (obstacle === 'stairs') g.s.map.stairs = { x: 6, y: 7 };
  if (obstacle === 'spear') g.s.hero.gear.hands[1] = makeWeapon('spear', 1);
  if (obstacle === 'unseen') g.s.visible.clear();
  const time = rangedAttack(g.s, 0, g.s.foes[0]!, hooks);
  expect(g.s.hero.pos).toEqual({ x: obstacle === 'open' ? 6 : 5, y: 7 });
  expect(fired(g, 'bladeRelay')).toHaveLength(obstacle === 'open' ? 1 : 0);
  expect(g.s.hero.gear.active).toBe(0);
  if (obstacle === 'open') {
    expect(g.s.foes[1]!.hp).toBeLessThan(g.s.foes[1]!.maxHp);
    expect(time).toBeCloseTo(1.3);
  }
});
it.each([1, 5])('spinShot spends only available charge (%i)', charge => {
  const g = setup(['spinShot'], [[6, 7], [5, 6], [5, 8]]);
  g.s.hero.gear.active = 1;
  g.s.hero.arrows = charge;
  g.s.foes.forEach(f => { f.hp = 1; });
  swing(g);
  expect(g.s.foes.filter(f => !f.alive)).toHaveLength(charge === 1 ? 2 : 3);
  expect(g.s.hero.arrows).toBe(charge === 1 ? 0 : 3);
  expect(fired(g, 'spinShot')).toHaveLength(1);
  expect(g.s.events.filter(e => e.text === 'spin').every(e => e.group === 'bow')).toBe(true);
});
it('spinShot ignores a lone neighbour', () => {
  const g = setup(['spinShot'], [[6, 7]]);
  g.s.hero.gear.active = 1;
  swing(g);
  expect(fired(g, 'spinShot')).toHaveLength(0);
});
it('counterShot shoots after a dodge with either hand active', () => {
  for (const active of [0, 1] as const) {
    const g = setup(['counterShot'], [[9, 7, 'archer']]);
    g.s.hero.gear.active = active;
    expect(defend(g.s, 0, 'f1', 'shot')).toBe('dodge');
    expect(g.s.foes[0]!.hp).toBeLessThan(g.s.foes[0]!.maxHp);
    expect(g.s.hero.arrows).toBe(23);
    expect(fired(g, 'counterShot')).toHaveLength(1);
    expect(g.s.hero.gear.active).toBe(active);
  }
});
it('riposte stuns a landed parry counter', () => {
  const g = setup(['riposte'], [[6, 7, 'brute']]);
  g.s.hero.gear.hands[1] = makeWeapon('sword', 1);
  g.s.hero.gear.active = 1;
  expect(defend(g.s, 0, 'f1', 'melee')).toBe('parry');
  expect(g.s.foes[0]!.stun).toBeGreaterThanOrEqual(1);
  expect(g.s.events.some(e => e.type === 'stun' && e.dst === 'f1')).toBe(true);
});
it.each(['brute', 'champion'] as const)('execute handles a slammed %s', kind => {
  const g = setup(['execute'], [[6, 7, kind]]);
  g.s.hero.gear.hands[1] = makeWeapon('mace', 1);
  g.s.hero.gear.active = 1;
  g.s.map.tiles[idx(g.s.map, { x: 7, y: 7 })] = 'wall';
  const foe = g.s.foes[0]!;
  pushFoe(g.s, 0, foe, { x: 1, y: 0 });
  expect(foe.hp).toBe(kind === 'champion' ? foe.maxHp - 3 - Math.ceil(foe.maxHp * 0.25) : 0);
  expect(foe.alive).toBe(kind === 'champion');
  expect(g.s.hero.arrows).toBe(23);
  expect(g.s.events.find(e => e.text === 'execute' && e.type === 'shoot')?.group).toBe('bow');
});
it('gunRelay follows leap and counter kills', () => {
  for (const leap of [true, false]) {
    const g = setup(['gunRelay', leap ? 'leap' : 'counter'], [[leap ? 8 : 6, 7], [10, 7]]);
    g.s.hero.gear.active = 1;
    g.s.foes.forEach(f => { f.hp = 1; });
    if (leap) lunge(g.s, 0, { x: 1, y: 0 }, hooks);
    else counterBlow(g.s, 0, 'f1', 'dodge');
    expect(g.s.foes.every(f => !f.alive)).toBe(true);
    expect(g.s.hero.gear.active).toBe(1);
  }
});
it.each([false, true])('chains cannot loop and flow=%s banks one free action', flow => {
  const g = setup(['gunRelay', 'bladeRelay', 'momentum', ...(flow ? ['flow' as const] : [])], [[6, 7], [5, 5], [7, 7]]);
  g.s.hero.gear.active = 1;
  g.s.foes.forEach(f => { f.hp = 1; });
  g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(g.s.events.find(e => e.type === 'chain')?.amount).toBeGreaterThanOrEqual(3);
  for (const id of g.s.hero.suit) expect(fired(g, id)).toHaveLength(1);
  expect(g.s.hero.gear.active).toBe(1);
  const before = g.s.hero.nextAt;
  g.act({ kind: 'wait' });
  expect(g.s.hero.nextAt - before).toBe(flow ? 0 : 0.5);
  const after = g.s.hero.nextAt;
  g.act({ kind: 'wait' });
  expect(g.s.hero.nextAt - after).toBeCloseTo(1);
});
it('flow survives zero-cost choices and blocked actions, including old fx', () => {
  const g = setup([], []);
  g.s.hero.fx.free = true;
  g.s.offers = [['dash']];
  g.act({ kind: 'choose', i: null });
  expect(g.s.hero.fx.free).toBe(true);
  g.act({ kind: 'shoot' });
  expect(g.s.hero.fx.free).toBe(true);
  g.act({ kind: 'wait' });
  expect(g.s.hero.nextAt).toBe(0);
  expect(g.s.hero.fx.free).toBe(false);
  Reflect.deleteProperty(g.s.hero.fx, 'free');
  g.act({ kind: 'wait' });
  expect(g.s.hero.nextAt).toBe(1);
  expect(g.s.hero.fx.free).toBe(false);
});
