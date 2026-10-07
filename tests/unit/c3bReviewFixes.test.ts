import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { implant } from '../../src/sim/roam/roam';
import { applyStatus } from '../../src/sim/party/status';
import { command, tick } from '../../src/sim/party/partySim';
import { action, emit } from '../../src/sim/party/triggers';
import { necroAmp } from '../../src/sim/party/cardsNecro';
import { necroScene } from './support/necroScene';
import { aiUltimate, useUltimate } from '../../src/sim/party/ultimate';
import type { BaseClass } from '../../src/sim/party/partyDefs';

const scene = (cls: BaseClass) => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 1; y < 13; y++) for (let x = 1; x < 20; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 4, y: 6 };
  implant(p, u, cls, []);
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; f.raised = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.raised = false; f.nextAt = 999; f.status = {};
    return f;
  };
  p.s.rng.chance = () => true;
  return { p, u, put };
};

it('a command that fails (an ultimate aimed at a wall) spends no turn: the every-turn effects do not go off', () => {
  const { p, u, put } = scene('mage'); u.traits = { meteor: 1 };
  const a = put(0, 10, 6); applyStatus(p, u, a, 'burn', 0, []);
  p.s.map.tiles[6 * p.s.map.w + 15] = 'wall';
  p.manual = 'hero'; p.waiting = true;
  for (let k = 0; k < 3; k++) expect(command(p, { kind: 'ultimate', cell: { x: 15, y: 6 } })).toEqual([]);
  expect(entOf(p, a.id)!.hp).toBe(999); expect(p.waiting).toBe(true);
});

it('teleport never lands on a unit that a burst at the start pushed into the cell', () => {
  const { p, u, put } = scene('mage'); u.traits = { frostRing: 1 };
  const a = put(0, 5, 6); put(1, 4, 7, 1);
  expect(useUltimate(p, 'hero', { x: 6, y: 6 }, 0).length).toBeGreaterThan(0);
  const me = entOf(p, 'hero')!.pos, at = entOf(p, a.id)!.pos;
  expect(me.x === at.x && me.y === at.y).toBe(false);
});

it('an AI mage pressed by two foes teleports away to a free cell', () => {
  const { p, u, put } = scene('mage'); u.traits = {};
  put(0, 5, 6); put(1, 4, 7);
  const pick = aiUltimate(p, u)!;
  expect(pick.cell).toBeDefined();
  expect(useUltimate(p, 'hero', pick.cell, pick.slot).length).toBeGreaterThan(0);
  expect(entOf(p, 'hero')!.pos).not.toEqual({ x: 4, y: 6 });
});

it('an AI necromancer raises its golem where the bodies lie thickest', () => {
  const s = necroScene();
  for (let k = 0; k < 3; k++) { const f = s.put(k, 10 + k, 8, 1); entOf(s.p, f.id)!.alive = false; f.raised = false; f.reaped = true; }
  s.put(4, 6, 6);
  const pick = aiUltimate(s.p, s.u)!;
  expect(pick.cell).toBeDefined();
  expect(useUltimate(s.p, 'hero', pick.cell, pick.slot).length).toBeGreaterThan(0);
  expect(s.p.units.some((x) => x.golem && entOf(s.p, x.id)?.alive)).toBe(true);
});

it('a companion whose chosen skill is refused lets it go instead of retrying the same cell for ever', () => {
  const { p, u, put } = scene('mage'); u.traits = {};
  put(0, 8, 6);
  u.ultQueued = true; u.ultSlot = 0; u.ultCell = { x: 8, y: 6 }; u.manualSkills = true; u.nextAt = 0;
  tick(p, 0.1);
  expect(u.ultQueued).toBe(false);
});

it('the blood pact takes its health only when the ultimate goes off', () => {
  const { p, u } = scene('mage'); u.traits = { bloodPact: 1 };
  const e = entOf(p, 'hero')!, hp = e.hp;
  p.s.map.tiles[6 * p.s.map.w + 15] = 'wall';
  expect(useUltimate(p, 'hero', { x: 15, y: 6 }, 0)).toEqual([]);
  expect(e.hp).toBe(hp);
});

it('raise skeleton waits for a fight: walking past bodies with no foe awake near raises nothing', () => {
  const s = necroScene(); s.u.traits = { raiseSkeleton: 1 };
  const f = s.put(0, 6, 6, 1); entOf(s.p, f.id)!.alive = false; f.raised = false;
  action(s.p, () => emit(s.p, 'turn', { t: 1, src: s.u, ev: [] }));
  expect(s.p.units.some((x) => x.summoner === s.u.id)).toBe(false);
  s.put(1, 10, 6);
  action(s.p, () => emit(s.p, 'turn', { t: 2, src: s.u, ev: [] }));
  expect(s.p.units.some((x) => x.summoner === s.u.id && entOf(s.p, x.id)?.alive)).toBe(true);
});

it('the legion mastery multiplies minion damage by 1.1 per #소환', () => {
  const s = necroScene(); s.u.traits = { legionAmp: 1, raiseSkeleton: 1, deadGrasp: 1, soulLink: 1 };
  const minion = { ...s.u, id: 'm', summoner: s.u.id, traits: {} } as Unit;
  expect(necroAmp(s.p, minion, 'physical')).toBeCloseTo(1.1 ** 4);
});
