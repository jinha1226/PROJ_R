import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { blank } from '../../src/sim/roam/roam';
import { entOf, unitOf, type Unit } from '../../src/sim/party/partyCore';
import { action, emit, type TriggerDef } from '../../src/sim/party/triggers';
import { spawnFoe } from '../../src/sim/grid/foes';
import type { GEvent } from '../../src/sim/grid/types';

const scene = () => {
  const p = newDelve(4, 1), u = unitOf(p, 'hero')!;
  const foe = p.units.find((x) => x.side === 'foe')!;
  return { p, u, foe };
};
const fire = (p: ReturnType<typeof scene>['p'], u: Unit) => { const ev: GEvent[] = []; action(p, () => { emit(p, 'hit', { t: 0, src: u, ev }); emit(p, 'hit', { t: 0, src: u, ev }); }); return ev; };

it('an effect that only sets a flag on another unit counts as a change: logged, and once per action', () => {
  const { p, u, foe } = scene();
  let runs = 0;
  u.triggers = [{ id: 'taunt-it', when: 'hit', run: () => { runs++; foe.tauntUntil = 50 + runs; } }];
  const ev: GEvent[] = [];
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev }));
  expect(ev.filter((e) => e.text === 'taunt-it')).toHaveLength(1);
});

it('marking a foe as already aimed at counts as a change', () => {
  const { p, u, foe } = scene();
  u.triggers = [{ id: 'aim', when: 'hit', run: () => { foe.sighted = [...(foe.sighted ?? []), u.id]; } }];
  expect(fire(p, u).filter((e) => e.text === 'aim').length).toBeGreaterThan(0);
});

it('an effect that changes nothing is not logged', () => {
  const { p, u } = scene();
  u.triggers = [{ id: 'nothing', when: 'hit', run: () => undefined }];
  expect(fire(p, u).some((e) => e.text === 'nothing')).toBe(false);
});

it('checking an effect stays cheap with a horde on the floor', () => {
  const time = (foes: number) => {
    const { p, u } = scene();
    for (let i = 0; i < foes; i++) { const e = spawnFoe(p.s, 'minion', { x: 1 + (i % 50), y: 1 + Math.floor(i / 50) }, true); p.units.push({ ...blank(), id: e.id, side: 'foe', foe: 'goblin' }); }
    u.triggers = Array.from({ length: 4 }, (_, i): TriggerDef => ({ id: `n${i}`, when: 'hit', run: () => undefined }));
    const t0 = performance.now();
    for (let k = 0; k < 200; k++) action(p, () => emit(p, 'hit', { t: k, src: u, ev: [] }));
    return performance.now() - t0;
  };
  time(300);
  // 200 actions × 4 checks with 300 foes: under 0.15 ms a check (a full JSON snapshot took about 0.4 ms)
  expect(time(300) / 800).toBeLessThan(0.15);
  void entOf;
});
