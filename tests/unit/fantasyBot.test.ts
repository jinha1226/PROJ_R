import { expect, it } from 'vitest';
import { makeWeapon } from '../../src/sim/grid/items';
import { freshMeta } from '../../src/sim/grid/meta';
import { newRunState } from '../../src/sim/grid/runSetup';
import { fromSave, toSave } from '../../src/sim/grid/save';
import { naiveDecide } from '../bot/runBot';
import { createMemory, smartDecide } from '../bot/brain/policy';
import { rangedReady } from '../bot/brain/view';
import { OPEN, sim } from '../sim/grid/kit';

it('bot bow readiness uses arrows even at zero mana', () => {
  const { s } = sim(OPEN, { x: 7, y: 7 });
  s.hero.charge = 0; expect(rangedReady(s)).toBe(true);
  s.hero.charge = 10; s.hero.arrows = 0; expect(rangedReady(s)).toBe(false);
});
it('bot staff readiness uses mana even with arrows in the quiver', () => {
  const { s } = sim(OPEN, { x: 7, y: 7 }); s.hero.gear.hands[0] = makeWeapon('staff', 1);
  s.hero.charge = 1; expect(rangedReady(s)).toBe(false);
  s.hero.arrows = 0; s.hero.charge = 2; expect(rangedReady(s)).toBe(true);
});
it('bot collects reachable arrows before stairs when safe, and leaves them when full', () => {
  const g = sim(OPEN, { x: 7, y: 7 }), s = g.s;
  s.map.stairs = { x: 8, y: 7 }; s.seen.fill(1);
  s.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'arrows', n: 6 } });
  s.hero.arrows = 0;
  expect(smartDecide(g, createMemory())).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
  s.hero.arrows = 40;
  expect(smartDecide(g, createMemory())).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
});
it('bot never attempts an empty bow shot at an awake foe', () => {
  const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'archer', pos: { x: 10, y: 7 } }]);
  g.s.hero.arrows = 0;
  expect(smartDecide(g, createMemory()).kind).not.toBe('shoot');
});
it('legacy pistol start options produce the new kit without changing meta', () => {
  const meta = freshMeta(), before = structuredClone(meta);
  const s = newRunState(21, meta, { gun: 'pistol', start: 1, startSuit: [] });
  expect(s.hero.gear.hands[0]?.group).toBe('bow'); expect(s.hero.arrows).toBe(24);
  expect(meta).toEqual(before);
});
it('round-trips an elemental staff, arrows, mana and its fractional regen clock', () => {
  const { s } = sim(OPEN, { x: 7, y: 7 });
  s.hero.gear.hands[0] = { ...makeWeapon('staff', 2), element: 'poison' };
  s.hero.arrows = 17; s.hero.charge = 3; s.hero.manaClock = 1.25;
  expect(fromSave(toSave(s)).hero).toEqual(s.hero);
});
it('collects nearby arrows before approaching a sleeping foe', () => {
  const g = sim(OPEN, { x: 7, y: 7 }, [{ kind: 'minion', pos: { x: 10, y: 7 }, awake: false }]);
  g.s.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'arrows', n: 1 } });
  g.s.hero.arrows = 0;
  expect(smartDecide(g, createMemory())).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
});
it('the naive bot also recovers nearby arrows when safe', () => {
  const g = sim(OPEN, { x: 7, y: 7 }); g.s.map.stairs = { x: 8, y: 7 }; g.s.seen.fill(1);
  g.s.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'arrows', n: 6 } });
  g.s.hero.arrows = 0;
  expect(naiveDecide(g)).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
});
it('the naive bot detects repeated movement and commits to a recovery route', () => {
  const g = sim(OPEN, { x: 7, y: 7 }), mem = createMemory();
  g.s.seen.fill(1); g.s.map.stairs = { x: 11, y: 7 };
  for (let i = 0; i < 8; i++) {
    g.s.hero.pos = { x: i % 2 ? 6 : 7, y: 7 };
    naiveDecide(g, undefined, mem);
  }
  expect(mem.notes.some(n => n.includes('recovered movement cycle'))).toBe(true);
  expect(mem.detour?.pos).toEqual(g.s.map.stairs);
});
it.each(['smart', 'naive'] as const)('%s clears a barrel when it blocks every route onward', policy => {
  const g = sim(['#######', '#.....#', '#######'], { x: 1, y: 1 });
  g.s.map.stairs = { x: 5, y: 1 }; g.s.seen.fill(1); g.s.hero.arrows = 0;
  g.s.barrels = [{ x: 2, y: 1 }];
  const action = policy === 'smart' ? smartDecide(g, createMemory()) : naiveDecide(g);
  expect(action).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(g.act(action).some(e => e.type === 'explode')).toBe(true);
});
