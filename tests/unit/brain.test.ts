import { afterEach, expect, it } from 'vitest';
import { idx, type GEvent } from '../../src/sim/grid/types';
import { BRAIN, KNACKS, knows } from '../../src/sim/party/brain';
import { snipe, takeChoke } from '../../src/sim/party/brainMoves';
import { entOf } from '../../src/sim/party/partyCore';
import { scene, put } from './support/cardScene';

const learn = (...ks: (typeof KNACKS)[number][]): void => { BRAIN.on = true; for (const k of KNACKS) BRAIN.knows[k] = ks.includes(k); };
afterEach(() => { BRAIN.on = false; for (const k of KNACKS) BRAIN.knows[k] = false; });

it('outside the test page the clones know what they always knew; on it, what is switched on', () => {
  expect(KNACKS.filter((k) => knows(k))).toEqual(['target', 'kite', 'ult', 'item']);
  learn('snipe');
  expect(KNACKS.filter((k) => knows(k))).toEqual(['snipe']);
});

it('shooting first: out of a fight a bow looses at a foe in sight that has not noticed, and the band wakes', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; u.gear = undefined;
  const [a, b] = foes; put(p, a!, 10, 4); put(p, b!, 11, 5); a!.asleep = b!.asleep = true; a!.group = b!.group = 7;
  for (const f of [a!, b!]) p.s.visible.add(idx(p.s.map, entOf(p, f.id)!.pos));
  p.combat = false; p.s.rng.chance = () => true;
  const ev: GEvent[] = [];
  expect(snipe(p, u, 1, ev)).toBe(false);
  learn('snipe');
  expect(snipe(p, u, 1, ev)).toBe(true);
  expect(entOf(p, a!.id)!.hp).toBeLessThan(200); expect(b!.asleep).toBe(false);
  expect(ev.some((e) => e.type === 'buff' && e.text === '먼저 쏘기')).toBe(true);
  // a blade does not; nor does anyone once the fight is on
  u.weapon = 'daggers'; a!.asleep = true; expect(snipe(p, u, 2, ev)).toBe(false);
  u.weapon = 'longbow'; p.combat = true; expect(snipe(p, u, 2, ev)).toBe(false);
});

it('a narrow place: as a fight with a band begins the clone walks into a passage one cell wide nearby, once a fight', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow';
  // a passage west of the clone at (4,4): (3,4) is its mouth, (2,4) its inside
  for (const [x, y] of [[1, 3], [2, 3], [3, 3], [1, 5], [2, 5], [3, 5]]) p.s.map.tiles[idx(p.s.map, { x: x!, y: y! })] = 'wall';
  const [a, b] = foes; put(p, a!, 9, 4); put(p, b!, 10, 4);
  for (const f of foes.slice(2)) f.asleep = true;
  p.combat = true;
  const ev: GEvent[] = [];
  takeChoke(p, u, 1, ev); expect(u.order).toBeFalsy();
  learn('choke');
  // one foe alone is not worth the walk
  entOf(p, b!.id)!.alive = false; takeChoke(p, u, 1, ev); expect(u.order).toBeFalsy();
  entOf(p, b!.id)!.alive = true; u.chokeAt = undefined;
  takeChoke(p, u, 2, ev);
  expect(u.order).toEqual({ kind: 'move', cell: { x: 2, y: 4 } });
  expect(ev.some((e) => e.text === '길목에서 받기')).toBe(true);
  // the fight over, the next one chooses afresh
  p.combat = false; takeChoke(p, u, 9, ev); expect(u.chokeAt).toBeUndefined();
});

it('a narrow place is given up when the foes do not come', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow';
  const [a, b] = foes; put(p, a!, 20, 1); put(p, b!, 21, 1);
  p.combat = true; learn('choke');
  u.chokeAt = 1; u.order = { kind: 'hold', cell: { x: 4, y: 4 } };
  // (nothing in reach: a wall between)
  for (let x = 1; x < 14; x++) if (x !== 4) p.s.map.tiles[idx(p.s.map, { x, y: 2 })] = 'wall';
  takeChoke(p, u, 3, []); expect(u.order).toBeTruthy();
  takeChoke(p, u, 6, []); expect(u.order).toBeNull();
});
