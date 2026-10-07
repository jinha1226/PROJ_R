import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, freeHit, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { action, emit, CHAIN_CAP, type Cond, type TriggerDef } from '../../src/sim/party/triggers';
import { applyStatus, tickStatuses } from '../../src/sim/party/status';
import type { GEvent } from '../../src/sim/grid/types';

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 9; y++) for (let x = 2; x < 16; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 5, y: 5 };
  for (const f of p.units) if (f.side === 'foe') { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!;
  fe.alive = true; fe.hp = fe.maxHp = 999; fe.pos = { x: 7, y: 5 }; foe.asleep = false; foe.reaped = false; foe.nextAt = 999; foe.sighted = [u.id];
  return { p, u, foe };
};
/** records which conditions the clone saw */
const spy = (u: Unit, conds: Cond[]): string[] => {
  const seen: string[] = [];
  u.triggers = conds.map((when): TriggerDef => ({ id: `spy-${when}`, when, repeat: true, run: (_p, c) => { seen.push(c.kind ? `${when}:${c.kind}` : when); } }));
  return seen;
};

it('every attack is an attack; only a landed one is a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['attack', 'hit']);
  p.s.rng.chance = () => true; strike(p, u, foe, p.time, []);
  expect(seen).toEqual(['attack', 'hit']);
  seen.length = 0; p.s.rng.chance = () => false; strike(p, u, foe, p.time, []);
  expect(seen).toEqual(['attack']);
  seen.length = 0; p.s.rng.chance = () => true; strike(p, u, foe, p.time, [], 1, false);
  expect(seen).toEqual(['attack', 'hit']);
});

it('damage an effect deals is damage, typed, never a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['hit', 'damage']);
  action(p, () => damage(p, p.time, u.id, foe, 10, [], true, false, 'fire'));
  expect(seen).toEqual(['damage:fire']);
});

it('a free hit ignores dodging and counts as a hit', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['hit']);
  foe.dodgeNext = true; p.s.rng.chance = () => false;
  const hp = entOf(p, foe.id)!.hp;
  action(p, () => freeHit(p, u, foe, 12, 'bone', p.time, []));
  expect(seen).toEqual(['hit']); expect(entOf(p, foe.id)!.hp).toBe(hp - 12);
});

it('damage over time is damage of its element', () => {
  const { p, u, foe } = scene(), seen = spy(u, ['damage']);
  applyStatus(p, u, foe, 'burn', p.time, []);
  tickStatuses(p, p.time, p.time + 1.5, []);
  expect(seen).toContain('damage:fire');
});

it('a fire-damage effect that deals fire damage does not feed itself forever; chains stop at the cap', () => {
  const { p, u, foe } = scene();
  u.triggers = [{ id: 'kindle', when: 'damage', test: (_p, c) => c.kind === 'fire', run: (pp, c) => damage(pp, c.t, u.id, foe, 1, c.ev, true, false, 'fire') }];
  const ev: GEvent[] = [];
  action(p, () => damage(p, p.time, u.id, foe, 1, ev, true, false, 'fire'));
  expect(ev.filter((e) => e.text === 'kindle')).toHaveLength(1);
  // a repeating one runs until the cap
  u.triggers = [{ id: 'kindle', when: 'damage', repeat: true, test: (_p, c) => c.kind === 'fire', run: (pp, c) => damage(pp, c.t, u.id, foe, 1, c.ev, true, false, 'fire') }];
  const ev2: GEvent[] = [];
  action(p, () => damage(p, p.time, u.id, foe, 1, ev2, true, false, 'fire'));
  expect(ev2.filter((e) => e.text === 'kindle')).toHaveLength(CHAIN_CAP);
  expect(CHAIN_CAP).toBe(30);
});

it('being hit is only an attack landing on the clone; any damage taken is damage taken, typed', () => {
  const { p, u, foe } = scene();
  const seen: string[] = [];
  u.triggers = (['struck', 'damaged'] as Cond[]).map((when): TriggerDef => ({ id: `spy-${when}`, when, repeat: true, run: (_p, c) => { seen.push(c.kind ? `${when}:${c.kind}` : when); } }));
  // a burn tick on the clone: damage taken, not a hit
  applyStatus(p, foe, u, 'burn', p.time, []);
  tickStatuses(p, p.time, p.time + 1.5, []);
  expect(seen).toContain('damaged:fire'); expect(seen).not.toContain('struck');
  // the foe's blow lands: a hit and damage taken
  seen.length = 0; p.s.rng.chance = () => true; foe.nextAt = 0;
  strike(p, foe, u, p.time, []);
  expect(seen).toEqual(['struck', 'damaged:physical']);
});

it('teleports and summons are events', () => {
  const { p, u } = scene(), seen = spy(u, ['teleport', 'summon']);
  action(p, () => emit(p, 'teleport', { t: p.time, src: u, ev: [] }));
  expect(seen).toEqual(['teleport']);
});
