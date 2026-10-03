import { expect, it } from 'vitest';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { toSave, fromSave } from '../../../src/sim/grid/save';
import { freshMeta } from '../../../src/sim/grid/meta';
import { nextFloor } from '../../../src/sim/grid/run';
import type { GAction } from '../../../src/sim/grid/types';
import { OPEN, sim } from './kit';

it('restores every field, typed collections and RNG without sharing state', () => {
  const meta = freshMeta();
  meta.suit = { floor: 2, ids: ['dash'], killer: { kind: 'mage' } };
  const g = GridSim.createRun(41, meta, { gun: 'pistol', start: 1, startSuit: [] });
  for (let i = 0; i < 8; i++) g.act({ kind: 'wait' });
  g.s.fired.add('dash'); g.s.hero.chargeClock = 1.25;
  g.s.run.recovered = ['rapid'];
  const restored = fromSave(toSave(g.s));
  expect(restored.visible).toBeInstanceOf(Set);
  expect(restored.fired).toBeInstanceOf(Set);
  expect(restored.seen).toBeInstanceOf(Uint8Array);
  expect(toSave(restored)).toBe(toSave(g.s));
  expect(restored.rng.next()).toBe(g.s.rng.next());
  nextFloor(restored); nextFloor(g.s);
  expect(toSave(restored)).toBe(toSave(g.s));
  restored.hero.suit.push('dash');
  expect(g.s.hero.suit).toEqual([]);
});
it('continues with identical combat events and state after N actions', () => {
  const original = sim(OPEN, { x: 3, y: 3 }, [{ kind: 'brute', pos: { x: 6, y: 3 } }], 722);
  original.s.hero.hp = original.s.hero.maxHp = 500;
  for (let i = 0; i < 4; i++) original.act({ kind: 'wait' });
  const restored = GridSim.fromState(fromSave(toSave(original.s)));
  const actions: GAction[] = Array.from({ length: 15 }, (_, i) => i % 3 === 0 ? { kind: 'shoot', target: 'f1' } : { kind: 'wait' });
  for (const action of actions) {
    expect(restored.act(action)).toEqual(original.act(action));
    expect(toSave(restored.s)).toBe(toSave(original.s));
  }
});
it.each(['bad', 'null', '{}', '{"version":99}'])('rejects invalid saves: %s', text => {
  expect(() => fromSave(text)).toThrow();
});
