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
