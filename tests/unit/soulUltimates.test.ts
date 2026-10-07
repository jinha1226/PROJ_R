import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant } from '../../src/sim/roam/roam';
import { entOf, unitOf } from '../../src/sim/party/partyCore';
import { ultSlots, useUltimate } from '../../src/sim/party/ultimate';
import { KITS } from '../../src/sim/party/classKit';

const hybrid = () => {
  const p = newDelve(8, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []); implant(p, u, 'archer', []);
  return { p, u };
};

it('each soul brings its own ultimate', () => {
  const { u } = hybrid();
  expect(ultSlots(u).map((s) => s.ult)).toEqual(['warcry', 'arrowRain']);
  // the empty body has its own one: the gravity grenade
  expect(ultSlots(unitOf(newDelve(8, 1), 'hero')!).map((s) => s.ult)).toEqual(['gravity']);
});

it('casting one soul ultimate leaves the other ready, at the cell the player chose', () => {
  const { p, u } = hybrid();
  const foe = p.units.find((x) => x.side === 'foe')!, fe = entOf(p, foe.id)!, me = entOf(p, 'hero')!;
  foe.asleep = false; fe.pos = { x: me.pos.x + 3, y: me.pos.y };
  // stand the foe on a floor cell within reach of the archer's rain
  expect(useUltimate(p, 'hero', fe.pos, 1).length).toBeGreaterThan(0);
  const [w, a] = ultSlots(u);
  expect(a!.ready).toBe(p.time + KITS.archer.ultCd);
  expect(w!.ready).toBeLessThanOrEqual(p.time);
  expect(useUltimate(p, 'hero', fe.pos, 1)).toEqual([]);
});
