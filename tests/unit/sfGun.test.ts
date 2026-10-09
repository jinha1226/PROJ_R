import { expect, it } from 'vitest';
import { newDelve, delveTick } from '../../src/sim/delve/delveSim';
import { entOf, strike, unitOf } from '../../src/sim/party/partyCore';
import type { GEvent } from '../../src/sim/grid/types';
import { MAG, magOf } from '../../src/sim/party/ammo';
import { proficient } from '../../src/sim/delve/gear';
import { takeParty, placeParty } from '../../src/sim/roam/carry';
import { CLASSES } from '../../src/sim/party/partyDefs';

const range = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!;
  fe.alive = true; fe.hp = fe.maxHp = 999; fe.pos = { x: me.pos.x + 3, y: me.pos.y }; foe.asleep = false;
  return { p, u, foe };
};

it('the empty body carries a pistol and the agent suit, and is proficient with the gun', () => {
  const { u, p } = range();
  expect(u.gear!.weapon!.def).toBe('pistol'); expect(u.gear!.armor!.def).toBe('agentSuit');
  expect(proficient(u)).toBe(true);
  expect(entOf(p, 'hero')!.maxHp).toBe(CLASSES.shell.hp);
});

it('each shot spends a round; an empty magazine reloads before the next shot', () => {
  const { p, u, foe } = range();
  expect(magOf(p, u)).toBe(MAG);
  for (let i = 0; i < MAG; i++) strike(p, u, foe, p.time, []);
  expect(u.ammo).toBe(0);
  const ev: GEvent[] = [];
  u.order = { kind: 'attack', target: foe.id }; u.nextAt = p.time;
  // the clone's next turn is a reload, then it shoots again
  // (driven through the sim tick so the reload takes the turn)
  for (let i = 0; i < 30 && !ev.some((e) => e.type === 'reload'); i++) ev.push(...delveTick(p, 0.1));
  expect(ev.some((e) => e.type === 'reload')).toBe(true);
  expect(u.ammo).toBe(MAG);
});

it('the magazine count survives a shaft trip', () => {
  const { p, u, foe } = range();
  strike(p, u, foe, p.time, []); strike(p, u, foe, p.time, []);
  const q = newDelve(5, 2); placeParty(q, takeParty(p));
  expect(unitOf(q, 'hero')!.ammo).toBe(MAG - 2);
});

it('out of a fight a gun with rounds missing is loaded by itself; in a fight it is not', () => {
  const { p, u, foe } = range();
  strike(p, u, foe, p.time, []); strike(p, u, foe, p.time, []);
  expect(u.ammo).toBe(MAG - 2);
  // the foe is awake and near: the fight is on, the magazine stays as it is
  let ev = delveTick(p, 0.1);
  expect(p.combat).toBe(true); expect(ev.some((e) => e.type === 'reload')).toBe(false); expect(u.ammo).toBeLessThanOrEqual(MAG - 2);
  // the fight over: one reload, and no more once the gun is full
  entOf(p, foe.id)!.alive = false; for (const f of p.units) if (f.side === 'foe') f.asleep = true;
  const spent = u.ammo!;
  ev = delveTick(p, 0.1);
  expect(p.combat).toBe(false); expect(spent).toBeLessThan(MAG);
  expect(ev.filter((e) => e.type === 'reload')).toHaveLength(1); expect(u.ammo).toBe(MAG);
  expect(delveTick(p, 0.1).some((e) => e.type === 'reload')).toBe(false);
});

it('a wait in a fight loads the gun when rounds are missing (it takes an attack\'s time); a full gun just waits', async () => {
  const { command } = await import('../../src/sim/party/partySim');
  const { stats } = await import('../../src/sim/party/partyCore');
  const { p, u, foe } = range();
  strike(p, u, foe, p.time, []);
  p.combat = true; p.manual = 'hero'; p.waiting = true;
  let ev = command(p, { kind: 'wait' });
  expect(ev.some((e) => e.type === 'reload')).toBe(true); expect(u.ammo).toBe(MAG);
  expect(u.nextAt - p.time).toBeCloseTo(Math.max(0.5, stats(u, p.time, p).atk));
  p.waiting = true;
  ev = command(p, { kind: 'wait' });
  expect(ev.some((e) => e.type === 'reload')).toBe(false); expect(ev.some((e) => e.type === 'wait')).toBe(true);
  expect(u.nextAt - p.time).toBeCloseTo(0.5);
});

it('the bar tells a gun\'s rounds left: amber when few, red when empty; nothing for a clone without a gun', async () => {
  const { ammoHtml } = await import('../../src/ui/overworld/partyFrames');
  const { p, u } = range();
  expect(ammoHtml(p, u)).toBe(`<span class="sb-ammo">탄 <b>${MAG}</b>/${MAG}</span>`);
  u.ammo = 2; expect(ammoHtml(p, u)).toContain('sb-ammo low'); expect(ammoHtml(p, u)).toContain('<b>2</b>');
  u.ammo = 0; expect(ammoHtml(p, u)).toContain('sb-ammo out');
  u.gear = { ...u.gear!, weapon: null };
  expect(ammoHtml(p, u)).toBe('');
});
