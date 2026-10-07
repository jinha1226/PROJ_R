import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { damage, entOf, strike, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { implant } from '../../src/sim/roam/roam';
import { action, emit } from '../../src/sim/party/triggers';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { aiUltimate, ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { laySnare, tickSnares } from '../../src/sim/party/snares';
import { tick } from '../../src/sim/party/partySim';
import type { GEvent } from '../../src/sim/grid/types';

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 1; y < 13; y++) for (let x = 1; x < 20; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 4, y: 6 };
  implant(p, u, 'rogue', []);
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; f.raised = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.raised = false; f.nextAt = 999; f.status = {};
    return f;
  };
  p.s.rng.chance = () => true;
  const turn = (t: number) => action(p, () => emit(p, 'turn', { t, src: u, ev: [] }));
  return { p, u, put, turn };
};
const hp = (p: ReturnType<typeof scene>['p'], f: Unit) => entOf(p, f.id)!.hp;

it('twelve rogue cards in three branches; the shadow clone is its ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'rogue');
  expect(cards).toHaveLength(12);
  for (const b of ['rogue:trap', 'rogue:martial', 'rogue:shadow']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  expect(ultSlots(scene().u).map((s) => s.ult)).toEqual(['shadowClone']);
});

it('lightning traps: in a fight one is laid near the rogue every turn (three at most); a foe stepping on one is struck and shocked', () => {
  const { p, u, turn, put } = scene(); u.traits = { lightningTrap: 1 };
  turn(1); expect(p.snares ?? []).toHaveLength(0);
  put(2, 11, 6);
  for (let t = 2; t <= 6; t++) turn(t);
  expect((p.snares ?? []).filter((s) => s.by === u.id)).toHaveLength(3);
  const s = p.snares![0]!, f = put(0, s.at.x, s.at.y);
  tickSnares(p, 7, []);
  expect(hp(p, f)).toBeLessThan(999); expect((f.status.shock?.until ?? 0) > 7).toBe(true);
  expect(s.charges).toBe(2);
});

it('chain detonation: one trap going off sets off every trap within two, each once', () => {
  const boom = (chain: boolean) => {
    const { p, u, turn, put } = scene(); u.traits = chain ? { lightningTrap: 1, chainDetonate: 1 } : { lightningTrap: 1 };
    put(2, 11, 6);
    for (let t = 1; t <= 3; t++) turn(t);
    const s = p.snares![0]!; put(0, s.at.x, s.at.y);
    const ev: GEvent[] = []; tickSnares(p, 6, ev);
    return { went: ev.filter((e) => e.text === '번개 함정').length, charges: p.snares!.map((x) => x.charges) };
  };
  expect(boom(false).went).toBe(1);
  expect(boom(true)).toEqual({ went: 3, charges: [2, 2, 2] });
});

it('fire trap: a step in a fight leaves a fire trap on the cell left; a foe on it is burnt', () => {
  const { p, u, put } = scene(); u.traits = { fireTrap: 1 };
  put(2, 11, 6);
  const ev: GEvent[] = [];
  const me = entOf(p, 'hero')!; ev.push({ t: 1, type: 'move', src: u.id, from: { ...me.pos }, to: { x: 5, y: 6 } }); me.pos = { x: 5, y: 6 };
  action(p, () => emit(p, 'moved', { t: 1, src: u, ev }));
  expect(p.snares?.map((x) => [x.kind, x.at])).toEqual([['fire', { x: 4, y: 6 }]]);
  const f = put(0, 4, 6); tickSnares(p, 2, []);
  expect(hp(p, f)).toBeLessThan(999); expect((f.status.burn?.until ?? 0) > 2).toBe(true);
  expect(p.snares).toHaveLength(0);
});

it('charge-up and the finishing blow: hits build ki; at three the next blow spends it and bursts round the target', () => {
  const { p, u, put } = scene(); u.traits = { chargeUp: 1, finisher: 1 };
  const a = put(0, 5, 6, 5000), b = put(1, 6, 6, 5000);
  for (let i = 0; i < 3; i++) strike(p, u, a, i, []);
  expect(u.ki).toBe(3);
  const hb = hp(p, b); strike(p, u, a, 3, []);
  expect(u.ki).toBe(0); expect(hp(p, b)).toBeLessThan(hb);
});

it('dragon claw: a kill by the finishing blow gives back two ki', () => {
  const { p, u, put } = scene(); u.traits = { chargeUp: 1, finisher: 1, dragonClaw: 1 };
  const a = put(0, 5, 6, 5000);
  for (let i = 0; i < 3; i++) strike(p, u, a, i, []);
  entOf(p, a.id)!.hp = 1; strike(p, u, a, 3, []);
  expect(u.ki).toBe(2);
});

it('shadow step: a kill hides the rogue, puts it beside the nearest foe and strikes at once', () => {
  const { p, u, put } = scene(); u.traits = { shadowStep: 1 };
  const a = put(0, 5, 6, 1), b = put(1, 8, 6);
  strike(p, u, a, 0, []);
  expect(u.hiddenUntil).toBeGreaterThan(0); expect(hp(p, b)).toBeLessThan(999);
});

it('shadow poison: a blow from hiding poisons three deep', () => {
  const { p, u, put } = scene(); u.traits = { shadowPoison: 1 };
  const a = put(0, 5, 6); u.hiddenUntil = 10;
  action(p, () => emit(p, 'hit', { t: 1, src: u, target: a, ev: [] }));
  expect(a.status.poison?.stacks).toBe(3);
});

it('shadow clone: two clones copy the rogue’s blows from where they stand and vanish at a touch; they never copy each other', () => {
  const { p, u, put } = scene();
  const a = put(0, 5, 6), b = put(1, 10, 9);
  expect(useUltimate(p, 'hero', { x: 10, y: 8 }, 0).length).toBeGreaterThan(0);
  const clones = p.units.filter((x) => x.summoner === u.id && x.mirror && entOf(p, x.id)?.alive);
  expect(clones).toHaveLength(2);
  expect(clones.every((c) => c.nextAt === Infinity)).toBe(true);
  const hb = hp(p, b); strike(p, u, a, 1, []);
  expect(hp(p, b)).toBeLessThan(hb);
  action(p, () => damage(p, 2, b.id, clones[0]!, 1, [], false, false, 'physical', true));
  expect(entOf(p, clones[0]!.id)!.alive).toBe(false);
  const ev: GEvent[] = []; strike(p, u, a, 3, ev);
  expect(ev.filter((e) => e.type === 'bump' && e.src === clones[1]!.id)).toHaveLength(1);
  expect(ev.filter((e) => e.type === 'bump' && e.src === clones[0]!.id)).toHaveLength(0);
});

it('snares go off as time runs: a foe standing on one when the party ticks is struck', () => {
  const { p, u, put } = scene();
  const f = put(0, 9, 9);
  laySnare(p, u, { x: 9, y: 9 }, 'bolt', 0, []);
  tick(p, 0.2);
  expect(hp(p, f)).toBeLessThan(999);
});

it('a rogue left to itself drops its clones at its own side once two foes are close', () => {
  const { p, u, put } = scene();
  put(0, 9, 9);
  expect(aiUltimate(p, u)).toBeNull();
  put(1, 5, 6); put(2, 5, 7);
  expect(aiUltimate(p, u)).toEqual({ slot: 0, cell: { x: 4, y: 6 } });
});
