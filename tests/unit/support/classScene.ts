import { newDelve } from '../../../src/sim/delve/delveSim';
import { entOf, unitOf, type Unit } from '../../../src/sim/party/partyCore';
import { implant } from '../../../src/sim/roam/roam';
import { action, emit } from '../../../src/sim/party/triggers';
import type { BaseClass } from '../../../src/sim/party/partyDefs';
import type { GEvent } from '../../../src/sim/grid/types';

/** An open room with one clone of the class at (4,6), every floor foe gone; `put` brings one back where wanted; rolls always succeed. */
export const classScene = (cls: BaseClass) => {
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
  const fire = (cond: Parameters<typeof emit>[1], t: number, extra: { target?: Unit; amount?: number; basic?: boolean } = {}) => {
    const ev: GEvent[] = []; action(p, () => emit(p, cond, { t, src: u, ev, ...extra })); return ev;
  };
  const hp = (f: Unit) => entOf(p, f.id)!.hp;
  return { p, u, put, fire, hp };
};
