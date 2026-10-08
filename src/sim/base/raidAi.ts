import { dist, type GEvent } from '../grid/types';
import { alive, canHit, entOf, occupied, posOf, stats, strike, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import { breakBuilding, buildingsAt } from './buildings';
import { blocks, podReach, raidStep, resetRaidPath } from './raidPath';

/**
 * A raid's elites on the grid (spec 2026-10-09 §2.3): a clone in reach is struck (an archer shoots any it can see), the pod
 * when they stand by it; otherwise they go nearly straight for the pod and break the barricade in the way — the horde leaks
 * through the hole after them.
 */
export function raidTurn(p: WorldParty, u: Unit, t: number, ev: GEvent[]): number | undefined {
  if (!p.raid || u.group !== p.raid.group || u.side !== 'foe' || !alive(p, u)) return undefined;
  const e = entOf(p, u.id)!, st = stats(u, t, p);
  const target = p.units.filter(h => h.side === 'hero' && alive(p, h) && canHit(p, u, h)).sort((a, b) => dist(e.pos, posOf(p, a)) - dist(e.pos, posOf(p, b)))[0];
  if (target) { strike(p, u, target, t, ev); return st.atk; }
  const amount = () => p.s.rng.int(st.dmg[0], st.dmg[1]);
  if (podReach(p, e.pos)) {
    const hit = amount(); p.podHp = Math.max(0, p.podHp - hit);
    ev.push({ t, type: 'bump', src: u.id, dst: 'pod', from: { ...e.pos }, to: { ...p.base } }, { t, type: 'hit', src: u.id, dst: 'pod', to: { ...p.base }, amount: hit });
    return st.atk;
  }
  const next = raidStep(p, e.pos);
  if (!next) return .5;
  let b = buildingsAt(p, next);
  // No corner cutting: break an orthogonal barricade before crossing its diagonal.
  if (!b && next.x !== e.pos.x && next.y !== e.pos.y) b = [buildingsAt(p, { x: next.x, y: e.pos.y }), buildingsAt(p, { x: e.pos.x, y: next.y })].find(x => x && blocks(x));
  if (b && blocks(b)) {
    const hit = amount(); b.hp = Math.max(0, b.hp - hit);
    ev.push({ t, type: 'bump', src: u.id, dst: b.id, from: { ...e.pos }, to: { ...b.at } }, { t, type: 'hit', src: u.id, dst: b.id, to: { ...b.at }, amount: hit });
    if (b.hp === 0) { breakBuilding(p, b); resetRaidPath(p); ev.push({ t, type: 'die', src: u.id, dst: b.id, to: { ...b.at } }); }
    return st.atk;
  }
  if (occupied(p, next, u.id)) return .3;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } }); e.pos = next; u.moved = true; u.still = 0;
  return st.move;
}
