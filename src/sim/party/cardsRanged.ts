import { alive, posOf, stats, type Party, type Unit } from './partyCore';
import { tagsOf } from './classKit';
import { ampBase, rank } from './traitTypes';
import { inBounds } from '../grid/types';


/** How much more a marked foe takes from this attacker (the hunter's eye card multiplies by the attacker's ranged tags). */
export const markMult = (attacker: Unit | undefined): number => 1.3 * (attacker && rank(attacker, 'hunterEye') ? ampBase(attacker, 'hunterEye', 1.1) ** (tagsOf(attacker).원거리 ?? 0) : 1);

/** The foes on the straight line from the shooter on past the target, nearest first (within the bow's reach). */
export function beyond(p: Party, u: Unit, target: Unit): Unit[] {
  const from = posOf(p, u), to = posOf(p, target), dx = to.x - from.x, dy = to.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy)) || 1, reach = stats(u, 0, p).range;
  const out: Unit[] = [];
  for (let k = n + 1; k <= reach + n; k++) {
    const c = { x: from.x + Math.round((dx * k) / n), y: from.y + Math.round((dy * k) / n) };
    if (!inBounds(p.s.map, c)) break;
    const f = p.units.find((x) => x.side === 'foe' && alive(p, x) && posOf(p, x).x === c.x && posOf(p, x).y === c.y);
    if (f) out.push(f);
  }
  return out;
}

