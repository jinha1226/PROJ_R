import { dist, type GEvent } from '../grid/types';
import { alive, canHit, damage, entOf, occupied, posOf, stats, strike, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import { buildingsAt, removeBuilding } from './buildings';
import { podReach, raidStep } from './raidPath';

/** Runs in the party scheduler: normal strikes against clones, otherwise break through to the pod. */
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
  // No corner cutting: break an orthogonal defence before crossing its diagonal.
  if (!b && next.x !== e.pos.x && next.y !== e.pos.y) {
    b = [buildingsAt(p, { x: next.x, y: e.pos.y }), buildingsAt(p, { x: e.pos.x, y: next.y })]
      .find(b => b && b.kind !== 'palisade');
  }
  if (b && b.kind !== 'palisade') {
    const hit = amount(); b.hp = Math.max(0, b.hp - hit);
    ev.push({ t, type: 'bump', src: u.id, dst: b.id, from: { ...e.pos }, to: { ...b.at } }, { t, type: 'hit', src: u.id, dst: b.id, to: { ...b.at }, amount: hit });
    if (b.hp === 0) { removeBuilding(p, b.id); ev.push({ t, type: 'die', src: u.id, dst: b.id, to: { ...b.at } }); }
    return st.atk;
  }
  if (occupied(p, next, u.id)) return .3;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } }); e.pos = next; u.moved = true; u.still = 0;
  return st.move;
}
export function towerTick(p: WorldParty, ev: GEvent[]): void {
  if (!p.raid) return;
  for (const b of p.buildings) {
    if (b.kind !== 'watchtower') continue;
    while (b.nextAt <= p.time) {
      const target = p.units.filter(u => u.side === 'foe' && u.group === p.raid!.group && alive(p, u) && dist(posOf(p, u), b.at) <= 6)
        .sort((a, c) => dist(posOf(p, a), b.at) - dist(posOf(p, c), b.at))[0];
      const t = b.nextAt; b.nextAt += 1.5;
      if (!target) continue;
      ev.push({ t, type: 'shoot', src: b.id, dst: target.id, from: { ...b.at }, to: { ...posOf(p, target) }, text: 'bow' });
      damage(p, t, b.id, target, p.s.rng.int(6, 9), ev);
    }
  }
}
