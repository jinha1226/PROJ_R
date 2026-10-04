import { afterEach, expect, it } from 'vitest';
import { DEFS } from '../../../src/sim/grid/engraveDefs';
import type { Trigger, TriggerCtx } from '../../../src/sim/grid/kataBus';
import { addStatus, applyElement, hurt } from '../../../src/sim/grid/status';
import { strike } from '../../../src/sim/grid/combat';
import { defend } from '../../../src/sim/grid/defense';
import { meleeAttack, rangedAttack } from '../../../src/sim/grid/weapons';
import { makeWeapon } from '../../../src/sim/grid/items';
import { OPEN, sim, sureHits } from './kit';

const old = DEFS.flow;
afterEach(() => { DEFS.flow = old; });
const hooks = { noise: () => {} };
function setup(trigger: Trigger) {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
  g.s.hero.suit = ['flow']; sureHits(g); g.s.foes[0]!.nextAt = 100;
  const seen: TriggerCtx[] = [];
  DEFS.flow = { on: trigger, when: (_s, c) => { seen.push({ ...c }); return true; }, effect: 'shield', p: 1 };
  return { g, seen, f: g.s.foes[0]! };
}
it.each(['meleeHit', 'meleeKill', 'gunHit', 'gunKill'] as const)('attacks dispatch %s with their target', trigger => {
  const { g, seen, f } = setup(trigger); if (trigger.endsWith('Kill')) f.hp = 1;
  if (trigger.startsWith('melee')) { g.s.hero.gear.active = 1; meleeAttack(g.s, 0, { x: 1, y: 0 }, f, hooks); }
  else rangedAttack(g.s, 0, f, hooks);
  expect(seen).toHaveLength(1); expect(seen[0]?.foe).toBe(f);
  if (trigger.endsWith('Kill')) expect(seen[0]?.count).toBe(1);
});
it.each(['meleeHit', 'gunHit'] as const)('misses do not dispatch %s', trigger => {
  const { g, seen, f } = setup(trigger); g.s.rng.chance = () => false;
  if (trigger === 'meleeHit') meleeAttack(g.s, 0, { x: 1, y: 0 }, f, hooks);
  else rangedAttack(g.s, 0, f, hooks);
  expect(seen).toEqual([]);
});
it.each(['parry', 'dodge'] as const)('defense dispatches %s with the attacker', trigger => {
  const { g, seen, f } = setup(trigger);
  if (trigger === 'parry') g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
  defend(g.s, 0, f.id, trigger === 'parry' ? 'melee' : 'shot');
  expect(seen[0]?.foe).toBe(f);
});
it.each(['hurt', 'strike'] as const)('%s dispatches hurt only for hero HP damage', path => {
  const { g, seen, f } = setup('hurt');
  if (path === 'hurt') hurt(g.s, 0, f.id, g.s.hero, 4);
  else strike(g.s, 0, f, g.s.hero, 1, [4, 4]);
  expect(seen[0]?.foe).toBe(f);
  g.s.hero.shield = 100;
  if (path === 'hurt') hurt(g.s, 0, f.id, g.s.hero, 4);
  else strike(g.s, 0, f, g.s.hero, 1, [4, 4]);
  expect(seen).toHaveLength(1);
});
it.each(['fire', 'frost', 'poison', 'shock'] as const)('hero %s emits elementApplied; enemy sources do not', element => {
  const { g, seen, f } = setup('elementApplied');
  addStatus(g.s, 0, f, element, 'mage'); expect(seen).toEqual([]);
  if (element === 'shock') { f.status = undefined; applyElement(g.s, 0, element, f.pos, 0, [1, 1], g.s.hero.id); }
  else addStatus(g.s, 0, f, element, g.s.hero.id);
  expect(seen[0]).toMatchObject({ foe: f, element });
});
it('hero reactions emit reaction and stunned with the affected foe', () => {
  for (const trigger of ['reaction', 'stunned'] as const) {
    const { g, seen, f } = setup(trigger);
    addStatus(g.s, 0, f, 'poison', 'mage');
    applyElement(g.s, 0, 'shock', f.pos, 0, [1, 1], g.s.hero.id);
    expect(seen[0]?.foe).toBe(f);
  }
});
it.each(['move', 'swap', 'wait'] as const)('successful %s dispatches its after trigger', kind => {
  const trigger = { move: 'afterMove', swap: 'afterSwap', wait: 'afterWait' } as const;
  const { g, seen } = setup(trigger[kind]);
  g.act(kind === 'move' ? { kind, dir: { x: -1, y: 0 } } : { kind });
  expect(seen).toHaveLength(1);
});
it('a bump, blocked step or frozen wait does not emit an after-action trigger', () => {
  const { g, seen } = setup('afterMove');
  g.act({ kind: 'move', dir: { x: 1, y: 0 } }); expect(seen).toEqual([]);
  g.s.hero.pos = { x: 1, y: 1 }; g.act({ kind: 'move', dir: { x: -1, y: 0 } }); expect(seen).toEqual([]);
  DEFS.flow!.on = 'afterWait'; g.s.hero.status = { burn: 0, poison: 0, freeze: 1 };
  g.act({ kind: 'wait' }); expect(seen).toEqual([]);
});
it('surrounded is emitted before the main blow while spin shots resolve after melee recharge', () => {
  const { g, seen } = setup('surrounded');
  g.s.foes.push({ ...g.s.foes[0]!, id: 'f2', pos: { x: 5, y: 6 }, hp: 1 });
  g.s.hero.suit = ['flow', 'spinShot']; g.s.hero.gear.active = 1; g.s.hero.charge = 0;
  let beforeBlow = false;
  DEFS.flow!.when = (s, c) => { seen.push(c); beforeBlow = !s.events.some(e => e.type === 'bump'); return true; };
  meleeAttack(g.s, 0, { x: 1, y: 0 }, g.s.foes[0]!, hooks);
  expect(beforeBlow).toBe(true); expect(seen).toHaveLength(1);
  expect(g.s.events.findIndex(e => e.text === 'spin')).toBeGreaterThan(g.s.events.findIndex(e => e.type === 'hit'));
  expect(g.s.fired.has('spinShot')).toBe(true); expect(g.s.hero.charge).toBe(0);
});
