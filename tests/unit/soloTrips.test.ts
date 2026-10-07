import { expect, it } from 'vitest';
import { newSurface, canDrill, drillClone } from '../../src/sim/overworld/worldSim';
import { departSurface, returnToSurface } from '../../src/sim/base/trips';
import { takeClone, takeParty } from '../../src/sim/roam/carry';
import { clones, living, print } from '../../src/sim/roam/roam';
import { entOf } from '../../src/sim/party/partyCore';
import { soulsOf } from '../../src/sim/party/body';

const twoAtDrill = () => {
  const p = newSurface(6);
  const b = print(p, 'mage', [], p.drill!)!;
  entOf(p, 'hero')!.pos = { ...p.drill! }; entOf(p, b.id)!.pos = { x: p.drill!.x + 1, y: p.drill!.y };
  return { p, b };
};

it('one clone at the drill is enough, and only it goes down', () => {
  const { p, b } = twoAtDrill();
  entOf(p, 'hero')!.pos = { x: p.drill!.x + 20, y: p.drill!.y };
  expect(canDrill(p)).toBe(true);
  expect(drillClone(p, 'hero')).toBe(b.id);
  const d = departSurface(p, 3, takeClone(p, b.id))!;
  expect(living(d).map((u) => u.id)).toEqual([b.id]);
  expect(living(p).map((u) => u.id)).toEqual(['hero']);
});

it('coming back, the clone joins the ones at home and its souls reach the base', () => {
  const { p, b } = twoAtDrill();
  const homePos = { ...entOf(p, 'hero')!.pos };
  p.carried = ['archer'];
  const c = takeClone(p, b.id);
  expect(c.carried).toEqual([]);
  expect(c.clones[0]!.unit.wentDown).toBe(true);
  const d = departSurface(p, 3, c)!;
  d.carried.push('warrior'); d.ore += 7;
  returnToSurface(p, takeParty(d));
  expect(living(p).map((u) => u.id).sort()).toEqual([b.id, 'hero'].sort());
  expect(entOf(p, 'hero')!.pos).toEqual(homePos);
  expect(p.carried).toEqual(['archer', 'warrior']);
  expect(p.ore).toBe(7);
});

it('the surface hero entity can go down and come back while another clone stayed', () => {
  const { p, b } = twoAtDrill();
  const d = departSurface(p, 3, takeClone(p, 'hero'))!;
  expect(living(p).map((u) => u.id)).toEqual([b.id]);
  returnToSurface(p, takeParty(d));
  expect(clones(p).filter((u) => entOf(p, u.id)?.alive).map((u) => u.id).sort()).toEqual([b.id, 'hero'].sort());
  expect(entOf(p, 'hero')).not.toBe(entOf(p, b.id));
});

it('a run that dies brings back no souls; the body that died had its souls lost', () => {
  const { p, b } = twoAtDrill();
  const d = departSurface(p, 3, takeClone(p, b.id))!;
  d.carried.push('warrior');
  entOf(d, b.id)!.alive = false;
  returnToSurface(p, takeParty(d));
  expect(p.carried).toEqual([]);
  expect(living(p).map((u) => u.id)).toEqual(['hero']);
  expect(soulsOf(clones(p).find((u) => u.id === 'hero')!)).toEqual([]);
});
