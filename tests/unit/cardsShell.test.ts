import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { magOf } from '../../src/sim/party/ammo';
import { rollOffer } from '../../src/sim/party/traitPool';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { implant } from '../../src/sim/roam/roam';
import { sourcesOf, emit, action } from '../../src/sim/party/triggers';
import type { GEvent } from '../../src/sim/grid/types';

/** an open strip of floor: the empty body at (5,5), foes placed by the test, all others gone */
const range = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 9; y++) for (let x = 2; x < 16; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 5, y: 5 };
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.nextAt = 999;
    return f;
  };
  // every shot lands unless a test says otherwise
  p.s.rng.chance = () => true;
  return { p, u, put, foe: put(0, 8, 5) };
};

it('the empty body is offered its own cards: two shell cards and a common', () => {
  const p = newDelve(5, 1), u = unitOf(p, 'hero')!; u.level = 4;
  for (let i = 0; i < 20; i++) {
    const pools = rollOffer(p, u).map((id) => TRAITS[id]!.pool);
    expect(pools.filter((x) => x === 'shell')).toHaveLength(2);
    expect(pools).toHaveLength(3);
  }
});

it('twelve shell cards with the shared tags; two innates come with the gun', () => {
  const shell = Object.values(TRAITS).filter((d) => d.pool === 'shell');
  expect(shell.map((d) => d.id).sort()).toEqual(['armorAmp', 'blastAmp', 'buttStroke', 'chainBlast', 'grenade', 'overheat', 'pierceRound', 'pointBlank', 'quickReload', 'returnFire', 'suitOverload', 'targetLock']);
  const { p, u } = range();
  const ids = sourcesOf(p, u).map((d) => d.id);
  expect(ids).toContain('조준 사격'); expect(ids).toContain('전술 재장전');
});

it('aimed shot: the first shot at each foe is critical', () => {
  const { p, u, foe } = range(), fe = entOf(p, foe.id)!;
  // the same roll every time; only the first shot at this foe is critical
  p.s.rng.int = (lo: number) => lo; p.s.rng.chance = (k: number) => k >= 0.5;
  const h0 = fe.hp; strike(p, u, foe, p.time, []); const first = h0 - fe.hp;
  const h1 = fe.hp; strike(p, u, foe, p.time, []); const second = h1 - fe.hp;
  expect(foe.sighted).toContain(u.id);
  expect(first).toBeGreaterThan(second);
});

it('return fire: a dodged blow is answered with a shot at the attacker', () => {
  const { p, u, foe } = range(); u.traits = { returnFire: 1 };
  const hp = entOf(p, foe.id)!.hp, ev: GEvent[] = [];
  action(p, () => emit(p, 'dodge', { t: p.time, src: u, target: foe, ev }));
  expect(entOf(p, foe.id)!.hp).toBeLessThan(hp);
});

it('overheat: three hits in a row set the foe burning', () => {
  const { p, u, foe } = range(); u.traits = { overheat: 1 };
  strike(p, u, foe, p.time, []); strike(p, u, foe, p.time, []);
  expect((foe.status.burn?.until ?? 0) > p.time).toBe(false);
  strike(p, u, foe, p.time, []);
  expect((foe.status.burn?.until ?? 0) > p.time).toBe(true);
});

it('quick reload: a kill refills the magazine and makes the next shot critical', () => {
  const { p, u, foe } = range(); u.traits = { quickReload: 1 }; u.ammo = 1;
  entOf(p, foe.id)!.hp = 1; strike(p, u, foe, p.time, []);
  expect(u.ammo).toBe(magOf(p, u)); expect(u.nextCrit).toBe(true);
});

it('butt stroke: a foe shot point-blank is pushed a cell back and stunned', () => {
  const { p, u, put } = range(); u.traits = { buttStroke: 1 };
  const near = put(1, 6, 5);
  strike(p, u, near, p.time, []);
  expect(entOf(p, near.id)!.pos).toEqual({ x: 7, y: 5 });
  expect((near.status.stun?.until ?? 0) > p.time).toBe(true);
});

it('suit overload: in a crisis the clone acts twice as fast for a turn, once a floor', () => {
  const { p, u } = range(); u.traits = { suitOverload: 1 };
  action(p, () => emit(p, 'crisis', { t: p.time, src: u, ev: [] }));
  expect(u.hasteUntil).toBeGreaterThan(p.time);
  u.hasteUntil = 0;
  action(p, () => emit(p, 'crisis', { t: p.time + 2, src: u, ev: [] }));
  expect(u.hasteUntil).toBe(0);
});

it('point blank: shots within two cells hit harder, more with every #원거리', () => {
  const a = range(), b = range();
  const near = a.put(1, 7, 5), far = b.put(1, 7, 5);
  a.u.traits = { pointBlank: 1 };
  // no aimed-shot crit: both have shot each foe once already
  near.sighted = [a.u.id]; far.sighted = [b.u.id];
  a.p.s.rng.int = (lo: number) => lo; b.p.s.rng.int = (lo: number) => lo;
  a.p.s.rng.chance = (k: number) => k >= 0.5; b.p.s.rng.chance = (k: number) => k >= 0.5;
  const ha = entOf(a.p, near.id)!.hp, hb = entOf(b.p, far.id)!.hp;
  strike(a.p, a.u, near, a.p.time, []); strike(b.p, b.u, far, b.p.time, []);
  expect(ha - entOf(a.p, near.id)!.hp).toBeGreaterThan(hb - entOf(b.p, far.id)!.hp);
});

it('target lock: a missed shot makes the next one critical', () => {
  const { p, u, foe } = range(); u.traits = { targetLock: 1 }; foe.sighted = [u.id];
  p.s.rng.chance = () => false;
  strike(p, u, foe, p.time, []);
  expect(u.nextCrit).toBe(true);
});

it('tactical reload: any reload brings the shield up to 8 and loads two hot rounds — each hits half again as hard and goes on into the foe behind', () => {
  const { p, u, foe, put } = range(); foe.sighted = [u.id];
  // (a foe stands right beside: the reload asks for no calm)
  put(2, 5, 6);
  const back = put(1, 11, 5), fe = entOf(p, foe.id)!, be = entOf(p, back.id)!;
  p.s.rng.int = (lo: number) => lo;
  // a plain shot, for the measure
  u.ammo = 3; let hp = fe.hp; strike(p, u, foe, p.time, []);
  const plain = hp - fe.hp;
  expect(be.hp).toBe(be.maxHp);
  u.ammo = 0; u.shield = 3; strike(p, u, foe, p.time, []);
  expect(u.ammo).toBe(magOf(p, u)); expect(u.hotRounds).toBe(2); expect(u.shield).toBe(8);
  for (const left of [1, 0]) {
    hp = fe.hp; const behind = be.hp;
    strike(p, u, foe, p.time, []);
    expect(Math.abs(hp - fe.hp - plain * 1.5)).toBeLessThanOrEqual(1); expect(be.hp).toBeLessThan(behind); expect(u.hotRounds).toBe(left);
  }
  // the third round is a plain one again
  hp = fe.hp; const behind = be.hp;
  strike(p, u, foe, p.time, []);
  expect(hp - fe.hp).toBe(plain); expect(be.hp).toBe(behind);
  // a shield already higher is left as it is
  u.ammo = 0; u.shield = 20; strike(p, u, foe, p.time, []);
  expect(u.shield).toBe(20);
});

it('a first soul at the lab drops the gun and every SF trace', () => {
  const p = newSurface(3), u = unitOf(p, 'hero')!; u.ammo = 2;
  implant(p, u, 'mage', []);
  expect(u.gear!.weapon!.def).not.toBe('pistol'); expect(u.ammo).toBeUndefined();
  u.level = 4;
  expect(rollOffer(p, u).some((id) => TRAITS[id]!.pool === 'shell')).toBe(false);
  expect(sourcesOf(p, u).map((d) => d.id)).not.toContain('조준 사격');
});
