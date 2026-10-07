import { newDelve } from '../../../src/sim/delve/delveSim';
import { entOf, unitOf, type Unit } from '../../../src/sim/party/partyCore';
import { implant } from '../../../src/sim/roam/roam';

/** An open room: a necromancer at (4,6), every floor foe gone (bodies used up), `put` brings one back where wanted. */
export const necroScene = (seed = 4) => {
  const p = newDelve(seed, 1), u = unitOf(p, 'hero')!, me = entOf(p, 'hero')!;
  for (let y = 2; y < 12; y++) for (let x = 2; x < 18; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  me.pos = { x: 4, y: 6 };
  implant(p, u, 'necromancer', []);
  const foes = p.units.filter((x) => x.side === 'foe');
  for (const f of foes) { entOf(p, f.id)!.alive = false; f.reaped = true; f.raised = true; }
  const put = (k: number, x: number, y: number, hp = 999): Unit => {
    const f = foes[k]!, e = entOf(p, f.id)!;
    e.alive = true; e.hp = e.maxHp = hp; e.pos = { x, y }; f.asleep = false; f.reaped = false; f.raised = false; f.nextAt = 999;
    return f;
  };
  return { p, u, put };
};
