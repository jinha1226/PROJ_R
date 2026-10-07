import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { action } from '../../src/sim/party/triggers';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { hammerCells, tickHammers, tickZones } from '../../src/sim/party/cardsCleric';
import { addShield } from '../../src/sim/party/shield';
import { heal } from '../../src/sim/party/kitEffects';
import { tagsOf } from '../../src/sim/party/classKit';
import { classScene } from './support/classScene';

const scene = () => classScene('cleric');

it('twelve cleric cards in three branches with their ranks; the sanctuary is its aimed ultimate', () => {
  const cards = Object.values(TRAITS).filter((d) => d.pool === 'cleric');
  expect(cards).toHaveLength(12);
  for (const b of ['cleric:hammer', 'cleric:shield', 'cleric:aura']) expect(cards.filter((d) => d.branch === b && d.sig)).toHaveLength(1);
  for (const d of cards) expect(d.ranks, d.id).toBe(d.kind === 'law' ? 3 : 2);
  expect(ultSlots(scene().u).map((s) => s.ult)).toEqual(['sanctum']);
});

it('blessed hammer: in a fight one hammer circles the cleric and strikes what it passes; a blow taken adds one for three turns (three at most)', () => {
  const { p, u, put, hp, fire } = scene(); u.traits = { hammer: 1 };
  put(5, 12, 10);
  expect(hammerCells(p, u, 0)).toHaveLength(1);
  const cell = hammerCells(p, u, 0)[0]!, a = put(0, cell.x, cell.y);
  tickHammers(p, 0.5, []);
  expect(hp(a)).toBeLessThan(999);
  for (let k = 0; k < 4; k++) fire('struck', 1 + k * 0.1, { target: a });
  expect(hammerCells(p, u, 1.5)).toHaveLength(3);
  expect(hammerCells(p, u, 4.6)).toHaveLength(1);
});

it('blessed hammer 3: a hammer kill bursts in holy light round the foe', () => {
  const { p, u, put, hp } = scene(); u.traits = { hammer: 3 };
  put(5, 12, 10);
  const cell = hammerCells(p, u, 0)[0]!; put(0, cell.x, cell.y, 1);
  const b = put(1, cell.x + (cell.x > 4 ? 1 : -1), cell.y);
  tickHammers(p, 0.5, []);
  expect(hp(b)).toBeLessThan(999);
});

it('hammer resonance: a hammer kill adds a hammer (to four)', () => {
  const { p, u, put } = scene(); u.traits = { hammer: 1, hammerResonance: 1 };
  put(5, 12, 10);
  const cell = hammerCells(p, u, 0)[0]!; put(0, cell.x, cell.y, 1);
  tickHammers(p, 0.5, []);
  expect(hammerCells(p, u, 0.5)).toHaveLength(2);
});

it('judgment: hits brand the foe; at five a holy burst stuns it; 3: the burst brands the foes round it twice', () => {
  const { u, put, hp, fire } = scene(); u.traits = { judgment: 3 };
  const a = put(0, 5, 6), b = put(1, 6, 6);
  for (let k = 0; k < 3; k++) fire('hit', k, { target: a });
  expect(hp(a)).toBeLessThan(999); expect((a.status.stun?.until ?? 0) > 2).toBe(true);
  expect(b.judge).toBe(2);
});

it('holy shield: the fight’s start gives ten, each turn three, each kill five', () => {
  const { p, u, put, fire } = scene(); u.traits = { divineShield: 1 }; u.shield = 0;
  const a = put(0, 9, 6, 1);
  fire('combatStart', 0); expect(u.shield).toBeGreaterThanOrEqual(10);
  const s0 = u.shield; fire('turn', 1); expect(u.shield - s0).toBe(3);
  const s1 = u.shield; action(p, () => damage(p, 1, u.id, a, 99, [], true)); expect(u.shield - s1).toBe(5);
});

it('holy shield 3: blows add a tenth of the shield', () => {
  const run = (r: number) => { const s = scene(); s.u.traits = { divineShield: r }; s.u.shield = 50; const f = s.put(0, 5, 6, 5000); strike(s.p, s.u, f, 1, []); return 5000 - s.hp(f); };
  expect(run(3) - run(2)).toBe(5);
});

it('shield burst: a broken shield hurts the foes beside by what broke (2: stuns; 3: two cells)', () => {
  const { p, u, put, hp } = scene(); u.traits = { shieldBurst: 3 }; u.shield = 0; addShield(u, 20);
  const a = put(0, 6, 6);
  action(p, () => damage(p, 1, a.id, u, 30, [], false, false, 'physical', true));
  expect(hp(a)).toBeLessThan(999); expect((a.status.stun?.until ?? 0) > 1).toBe(true);
});

it('overflowing grace: overflowing healing becomes twice the shield (three times at 2)', () => {
  const { p, u } = scene(); u.traits = { overflowGrace: 2 }; u.shield = 0;
  heal(p, u, u, 10, 0, []);
  expect(u.shield).toBe(30);
});

it('sacred wall: shields ×1.15 per #방패 (multiplied)', () => {
  const { u } = scene(); u.traits = { sacredWall: 1, divineShield: 1, shieldBurst: 1 }; u.shield = 0;
  addShield(u, 10, u);
  expect(u.shield).toBe(Math.round(10 * 1.15 ** (tagsOf(u).방패 ?? 0)));
});

it('purifying aura: each turn in a fight the foes within two take holy damage; a kill in the aura adds a fifth to the next turn’s', () => {
  const { p, u, put, hp, fire } = scene(); u.traits = { purifyAura: 1 };
  const a = put(0, 6, 6), far = put(1, 9, 6);
  fire('turn', 1);
  const once = 999 - hp(a); expect(once).toBeGreaterThan(0); expect(hp(far)).toBe(999);
  const weak = put(2, 5, 7, 1); action(p, () => damage(p, 1.5, u.id, weak, 99, [], true));
  const before = hp(a); fire('turn', 2);
  expect(before - hp(a)).toBe(Math.round(once * 1.2));
});

it('purifying aura 3: a foe dying in the aura bursts in holy light', () => {
  const { p, u, put, hp } = scene(); u.traits = { purifyAura: 3 };
  const a = put(0, 6, 6, 1), b = put(1, 7, 7);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(hp(b)).toBeLessThan(999);
});

it('zeal aura: a kill in the aura quickens the cleric two turns', () => {
  const { p, u, put } = scene(); u.traits = { purifyAura: 1, zealAura: 1 };
  const a = put(0, 6, 6, 1);
  action(p, () => damage(p, 1, u.id, a, 99, [], true));
  expect(u.zealUntil).toBe(3);
});

it('life transfer: healing sends a share to the nearest foe as damage', () => {
  const { p, u, put, hp } = scene(); u.traits = { lifeTransfer: 2 };
  const a = put(0, 8, 6); entOf(p, 'hero')!.hp = 1;
  heal(p, u, u, 20, 0, []);
  expect(999 - hp(a)).toBe(10);
});

it('aura mastery multiplies the aura ×1.2 per #오라', () => {
  const run = (amp: boolean) => { const s = scene(); s.u.traits = amp ? { purifyAura: 1, auraAmp: 1 } : { purifyAura: 1 }; const f = s.put(0, 6, 6); s.fire('turn', 1); return 999 - s.hp(f); };
  expect(run(true)).toBe(Math.round(run(false) * 1.2 ** 2));
});

it('sanctuary: allies inside are untouchable and foes inside take holy damage each turn for three turns', () => {
  const { p, u, put, hp } = scene();
  const a = put(0, 9, 7);
  p.s.map.tiles[6 * p.s.map.w + 9] = 'wall';
  expect(useUltimate(p, 'hero', { x: 9, y: 6 }, 0)).toEqual([]);
  p.s.map.tiles[6 * p.s.map.w + 9] = 'floor';
  entOf(p, 'hero')!.pos = { x: 8, y: 6 };
  expect(useUltimate(p, 'hero', { x: 9, y: 6 }, 0).length).toBeGreaterThan(0);
  tickZones(p, p.time + 1, []);
  expect(hp(a)).toBeLessThan(999); expect((u.immuneUntil ?? 0) > p.time).toBe(true);
  tickZones(p, p.time + 4, []);
  expect(p.zones ?? []).toEqual([]);
});
