import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { BRANCHES, branchOf, sigCards } from '../../src/sim/party/branches';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { action, emit, type Cond, type TriggerDef } from '../../src/sim/party/triggers';
import { applyStatus } from '../../src/sim/party/status';
import type { GEvent } from '../../src/sim/grid/types';

const range = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 10; y++) for (let x = 2; x < 18; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 5, y: 5 };
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.nextAt = 999; f.sighted = [u.id];
    return f;
  };
  p.s.rng.chance = () => true;
  return { p, u, put };
};
const spy = (u: Unit, conds: Cond[]): string[] => {
  const seen: string[] = [];
  u.triggers = conds.map((when): TriggerDef => ({ id: `spy-${when}`, when, repeat: true, run: () => { seen.push(when); } }));
  return seen;
};

it('the empty body has three branches, every shell card in one, one signature each', () => {
  expect(BRANCHES.filter((b) => b.line === 'shell').map((b) => b.id)).toEqual(['shell:shot', 'shell:blast', 'shell:suit']);
  const shell = Object.values(TRAITS).filter((d) => d.pool === 'shell');
  expect(shell).toHaveLength(12);
  for (const b of BRANCHES.filter((x) => x.line === 'shell')) {
    const cards = shell.filter((d) => d.branch === b.id);
    expect(cards).toHaveLength(4);
    expect(cards.filter((d) => d.sig)).toHaveLength(1);
  }
  expect(sigCards('shell').sort()).toEqual(['grenade', 'pierceRound', 'returnFire']);
  expect(branchOf('overheat')?.id).toBe('shell:blast');
});

it('grenade: every third shot blasts the foes round the target with fire damage, which is not a hit', () => {
  const { p, u, put } = range(); u.traits = { grenade: 1 };
  const foe = put(0, 9, 5), side = put(1, 10, 5), hp = entOf(p, side.id)!.hp;
  const seen = spy(u, ['hit']);
  strike(p, u, foe, p.time, []); strike(p, u, foe, p.time, []);
  expect(entOf(p, side.id)!.hp).toBe(hp);
  u.traits = { grenade: 1 }; seen.length = 0;
  const ev: GEvent[] = []; strike(p, u, foe, p.time, ev);
  expect(entOf(p, side.id)!.hp).toBeLessThan(hp);
  expect((side.status.burn?.until ?? 0) > p.time).toBe(true);
  expect(seen).toEqual(['hit']);
});

it('chain blast: a foe killed by fire damage blows up where it fell, and that blast can kill and blow up again', () => {
  const { p, u, put } = range(); u.traits = { chainBlast: 1 };
  const a = put(0, 9, 5, 5), b = put(1, 10, 5, 5), c = put(2, 11, 5, 5);
  const ev: GEvent[] = [];
  action(p, () => damage(p, p.time, u.id, a, 50, ev, true, false, 'fire'));
  expect([a, b, c].every((f) => !entOf(p, f.id)!.alive)).toBe(true);
  expect(ev.filter((e) => e.text === '연쇄 폭발').length).toBeGreaterThanOrEqual(2);
});

it('pierce round: from three hits in a row every shot also goes into the foe behind; a miss starts the count again', () => {
  const { p, u, put } = range(); u.traits = { pierceRound: 1 };
  const foe = put(0, 8, 5), back = put(1, 11, 5), hp = entOf(p, back.id)!.hp;
  strike(p, u, foe, p.time, []); strike(p, u, foe, p.time, []);
  expect(entOf(p, back.id)!.hp).toBe(hp);
  strike(p, u, foe, p.time, []);
  const after3 = entOf(p, back.id)!.hp; expect(after3).toBeLessThan(hp);
  p.s.rng.chance = () => false; strike(p, u, foe, p.time, []);
  p.s.rng.chance = () => true; strike(p, u, foe, p.time, []);
  expect(entOf(p, back.id)!.hp).toBe(after3);
});

it('return fire: a blow taken or dodged is answered with a shot, at most two a turn', () => {
  const { p, u, put } = range(); u.traits = { returnFire: 1 };
  const foe = put(0, 8, 5), seen = spy(u, ['attack']);
  u.traits = { returnFire: 1 };
  for (let k = 0; k < 3; k++) action(p, () => emit(p, 'struck', { t: 10, src: u, target: foe, ev: [] }));
  expect(seen.length).toBe(2);
  action(p, () => emit(p, 'dodge', { t: 11, src: u, target: foe, ev: [] }));
  expect(seen.length).toBe(3);
});

it('armour mastery multiplies damage taken by 0.96 per #생존', () => {
  const { p, u, put } = range(), foe = put(0, 6, 5);
  u.traits = { armorAmp: 1, suitOverload: 1, returnFire: 1 };
  const e = entOf(p, 'hero')!; e.hp = e.maxHp = 1000; u.gear!.armor = null;
  damage(p, p.time, foe.id, u, 100, []);
  const taken = 1000 - e.hp, n = [1, 2, 3].length;
  expect(taken).toBe(Math.max(1, Math.round(100 * 0.96 ** n)));
  void applyStatus;
});
