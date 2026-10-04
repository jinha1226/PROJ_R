import { afterEach, expect, it } from 'vitest';
import { emit } from '../../../src/sim/grid/kataBus';
import { DEFS } from '../../../src/sim/grid/engraveDefs';
import { canRun, runEffect } from '../../../src/sim/grid/kataEffects';
import { hurt } from '../../../src/sim/grid/status';
import { strike } from '../../../src/sim/grid/combat';
import { meleeAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const original = { ...DEFS };
afterEach(() => { for (const id of Object.keys(DEFS)) Reflect.deleteProperty(DEFS, id); Object.assign(DEFS, original); });
const setup = () => sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
it('empty suits and unavailable effects do not fire or mutate state', () => {
  const g = setup(); g.s.hero.suit = [];
  emit(g.s, 'stunned', { t: 0, foe: g.s.foes[0] });
  expect(g.s.events).toEqual([]);
  g.s.hero.suit = ['execute']; g.s.hero.charge = 0;
  const before = JSON.stringify(g.s);
  expect(canRun(g.s, 'execute', { t: 0, foe: g.s.foes[0] })).toBe(false);
  expect(runEffect(g.s, 'execute', { t: 0, foe: g.s.foes[0] })).toBe(false);
  emit(g.s, 'stunned', { t: 0, foe: g.s.foes[0] });
  expect(JSON.stringify(g.s)).toBe(before);
  expect(g.s.fired.size).toBe(0);
});
it('checks hand fit and conditions, and executes definitions in suit order once', () => {
  const g = setup(); g.s.hero.suit = ['dash', 'flow', 'counterShot'];
  DEFS.dash = { on: 'afterWait', effect: 'shield', p: 9 };
  DEFS.flow = { on: 'afterWait', effect: 'shield', p: 2 };
  DEFS.counterShot = { on: 'afterWait', when: s => s.hero.shield === 2, effect: 'shield', p: 3 };
  emit(g.s, 'afterWait', { t: 0 }); emit(g.s, 'afterWait', { t: 0 });
  expect(g.s.hero.shield).toBe(5);
  expect(g.s.events.map(e => e.text)).toEqual(['flow', 'counterShot']);
});
it('kill-trigger ping-pong fires both engravings once despite nested attacks', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ x: 6, y: 7 }, { x: 5, y: 5 }, { x: 7, y: 7 }, { x: 9, y: 7 }].map(pos => ({ kind: 'minion', pos })));
  sureHits(g); g.s.hero.gear.active = 1; g.s.hero.suit = ['gunRelay', 'bladeRelay'];
  g.s.foes.forEach(f => { f.hp = 1; });
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, { noise: () => {} });
  expect(g.s.events.filter(e => e.type === 'engrave').map(e => e.text)).toEqual(['gunRelay', 'bladeRelay']);
  expect(g.s.foes.filter(f => !f.alive)).toHaveLength(3);
});
it.each(['hurt', 'strike'] as const)('shield absorbs before HP through %s, including old heroes without shield', path => {
  const g = setup(); sureHits(g); const h = g.s.hero; const hp = h.hp; h.gear.armor = null;
  const hit = () => path === 'hurt' ? hurt(g.s, 0, 'f1', h, 4) : strike(g.s, 0, g.s.foes[0]!, h, 1, [4, 4]);
  runEffect(g.s, 'shield', { t: 0 }, 6);
  hit(); expect(h.hp).toBe(hp); expect(h.shield).toBe(2);
  hit(); expect(h.hp).toBe(hp - 2); expect(h.shield).toBe(0);
  expect(g.s.events.filter(e => e.type === 'shield').map(e => e.amount)).toEqual([4, 2]);
  delete h.shield; hit(); expect(h.hp).toBe(hp - 6);
});
it('utility effects cap recovery and preserve the larger next multiplier', () => {
  const g = setup(); const h = g.s.hero;
  h.hp -= 1; h.charge -= 1;
  expect(runEffect(g.s, 'heal', { t: 0 }, 3)).toBe(true); expect(h.hp).toBe(h.maxHp);
  expect(runEffect(g.s, 'charge', { t: 0 }, 3)).toBe(true); expect(h.charge).toBe(h.maxCharge);
  expect(runEffect(g.s, 'heal', { t: 0 })).toBe(false);
  runEffect(g.s, 'nextMult', { t: 0 }, 2); runEffect(g.s, 'nextMult', { t: 0 }, 1.5);
  expect(h.fx.nextMult).toBe(2);
  expect(runEffect(g.s, 'freeNext', { t: 0 })).toBe(true); expect(h.fx.free).toBe(true);
});
