import { dist, idx, type GEvent } from '../grid/types';
import { alive, canHit, entOf, occupied, posOf, stats, strike, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import { domeUp, hitDome, SIEGE_GROUP } from './siege';
import { inDome, rimOf, siegeStep } from './siegePath';

/**
 * The siege's elites on the grid (ogres, archers, the general): a clone out in the open and in reach is struck (the dome
 * shelters those under it), at the dome's rim the dome itself; otherwise they walk to the rim.
 */
export function siegeTurn(p: WorldParty, u: Unit, t: number, ev: GEvent[]): number | undefined {
  if (!p.siege || u.group !== SIEGE_GROUP || u.side !== 'foe' || !alive(p, u)) return undefined;
  const e = entOf(p, u.id)!, st = stats(u, t, p), up = domeUp(p);
  const target = p.units.filter((h) => h.side === 'hero' && alive(p, h) && !(up && inDome(p, posOf(p, h))) && canHit(p, u, h)).sort((a, b) => dist(e.pos, posOf(p, a)) - dist(e.pos, posOf(p, b)))[0];
  if (target) { strike(p, u, target, t, ev); return st.atk; }
  if (up && rimOf(p).has(idx(p.s.map, e.pos))) {
    ev.push({ t, type: 'bump', src: u.id, dst: 'dome', from: { ...e.pos }, to: { x: p.base.x + 1, y: p.base.y + 1 } });
    hitDome(p, p.s.rng.int(st.dmg[0], st.dmg[1]), u.id, e.pos, ev);
    return st.atk;
  }
  const next = siegeStep(p, e.pos);
  if (!next) return 0.5;
  if (occupied(p, next, u.id)) return 0.3;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } }); e.pos = next; u.moved = true; u.still = 0;
  return st.move;
}
