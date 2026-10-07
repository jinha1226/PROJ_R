import { tickTraitRegen } from './traitCombat';
import { mods } from './traitMods';
import { alive, damage, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import { emit } from './triggers';
import { resonant } from './resonance';
import { markMult } from './cardsRanged';
import { bleedCap } from './cardsWarrior';
export type StatusId = 'burn' | 'chill' | 'freeze' | 'poison' | 'shock' | 'bleed' | 'stun' | 'mark' | 'exposed';
export interface Status { until: number; stacks?: number; by?: string; next?: number }
const duration: Record<StatusId, number> = { burn: 3, chill: 3, freeze: 2, poison: 4, shock: Infinity, bleed: 4, stun: 1, mark: 4, exposed: 3 };
export function applyStatus(p: Party, src: Unit, target: Unit, id: StatusId, t: number, ev: GEvent[], stacks = 1, spread = false): void {
  if (!alive(p, src) || !alive(p, target)) return;
  const old = target.status[id], live = old && old.until > t ? old.stacks ?? 1 : 0;
  // poison stacks to five (eight with poison 3); burns stack with fire 6
  const stack = id === 'poison' ? Math.min(5 + (mods(src).poisonCap ?? 0) + (resonant(p, src, '독', 1) ? 3 : 0), live + stacks)
    : id === 'burn' && resonant(p, src, '화염', 2) ? live + stacks
    : id === 'bleed' && bleedCap(src) > 1 ? Math.min(bleedCap(src), live + stacks) : stacks;
  const extra = (id === 'freeze' && resonant(p, src, '냉기', 2) ? 1 : 0) + (id === 'stun' && resonant(p, src, '함성', 1) ? 1 : 0);
  target.status[id] = { until: t + duration[id] + extra, by: src.id, stacks: stack, next: old && old.until > t ? old.next : t + 1 };
  if (id === 'freeze' || id === 'stun') target.nextAt = Math.max(target.nextAt, t + duration[id] + extra);
  ev.push({ t, type: 'buff', src: src.id, dst: target.id, text: id });
  if((id==='shock'||id==='bleed') && target.status.bleed && (target.status.shock?.until??0)>t) {target.status.bleed.stacks=2;react(p,src,target,id,'혈전',t,ev);}
  emit(p, 'statusApplied', { t, src, target, status: id, ev });
  if (!spread && (id === 'burn' || id === 'poison') && (target.status.burn?.until ?? 0) > t && (target.status.poison?.until ?? 0) > t) {
    react(p, src, target, id, '독연 폭발', t, ev);
    for (const f of p.units) if (f !== target && f.side === target.side && alive(p, f) && dist(posOf(p, f), posOf(p, target)) <= 1) applyStatus(p, src, f, 'poison', t, ev, 2, true);
  }
  elemental(p, src, target, id, t, ev);
}
const on = (u: Unit, id: StatusId, t: number) => (u.status[id]?.until ?? 0) > t;
/** A reaction: its mark for the screen, and an event effects can hang on. */
function react(p: Party, src: Unit, target: Unit, id: StatusId, name: string, t: number, ev: GEvent[]): void {
  ev.push({ t, type: 'react', src: src.id, dst: target.id, text: name });
  emit(p, 'reaction', { t, src, target, status: id, reaction: name, ev });
}
/** The elements meeting on one foe: burn and chill make steam, burn and shock overload, chill and shock leave it exposed. Both states go. */
function elemental(p: Party, src: Unit, target: Unit, id: StatusId, t: number, ev: GEvent[]): void {
  const pair = (a: StatusId, b: StatusId) => (id === a || id === b) && on(target, a, t) && on(target, b, t);
  const boost = 1 + (mods(src).react ?? 0), round = p.units.filter((f) => f.side === target.side && alive(p, f) && dist(posOf(p, f), posOf(p, target)) <= 1);
  if (pair('burn', 'chill')) {
    delete target.status.burn; delete target.status.chill; react(p, src, target, id, '증기', t, ev);
    for (const f of round) { f.blindUntil = Math.max(f.blindUntil ?? 0, t + 2); damage(p, t, src.id, f, Math.round(6 * boost), ev, true); }
  } else if (pair('burn', 'shock')) {
    delete target.status.burn; delete target.status.shock; react(p, src, target, id, '과부하', t, ev);
    for (const f of round) damage(p, t, src.id, f, Math.round(10 * boost), ev, true);
  } else if (pair('chill', 'shock')) {
    delete target.status.chill; delete target.status.shock; react(p, src, target, id, '초전도', t, ev);
    applyStatus(p, src, target, 'exposed', t, ev);
  }
}
export function tickStatuses(p: Party, _from: number, to: number, ev: GEvent[]): void {
  tickTraitRegen(p,_from,to,ev);
  for (const u of p.units) {
    for (const id of ['burn', 'poison'] as const) {
      const s = u.status[id];
      if (!s) continue;
      while (alive(p, u) && (s.next ?? Infinity) <= Math.min(to, s.until)) {
        damage(p, s.next!, s.by ?? '', u, (id === 'burn' ? 3 : 2) * (s.stacks ?? 1), ev, true, false, id === 'burn' ? 'fire' : 'poison'); s.next!++;
      }
    }
    for (const id of Object.keys(u.status) as StatusId[]) if (u.status[id]!.until <= to) delete u.status[id];
  }
}
export function movedStatus(p: Party, u: Unit, t: number, ev: GEvent[]): void {
  const s = u.status.bleed, by = (id?: string) => p.units.find((x) => x.id === id);
  if (s && t < s.until) damage(p, t, s.by ?? '', u, 4*(s.stacks??1)*(resonant(p, by(s.by), '출혈', 1) ? 2 : 1), ev, true, false, 'physical');
  const c = u.status.chill;
  if (c && t < c.until && resonant(p, by(c.by), '냉기', 1)) damage(p, t, c.by ?? '', u, 4, ev, true, false, 'cold');
}
export function statusMult(p: Party, attacker: Unit, target: Unit, heavy: boolean, t: number, ev: GEvent[]): number {
  let m = 1;
  if ((target.status.freeze?.until ?? 0) > t && heavy) { m *= 2; delete target.status.freeze; react(p, attacker, target, 'freeze', '파쇄', t, ev); }
  else if ((target.status.freeze?.until ?? 0) > t && resonant(p, attacker, '냉기', 2)) m *= 1.5;
  if ((target.status.mark?.until ?? 0) > t && target.status.mark?.by !== attacker.id) m *= markMult(attacker);
  if ((target.status.exposed?.until ?? 0) > t) m *= 1.5;
  if ((target.status.shock?.until ?? 0) > t) {
    delete target.status.shock;
    const charged = resonant(p, attacker, '전기', 1), hard = resonant(p, attacker, '전기', 2);
    const near = (at: Unit, skip: Set<Unit>) => p.units.filter((f) => !skip.has(f) && f.side === target.side && alive(p, f) && dist(posOf(p, f), posOf(p, at)) <= 2);
    const hit = new Set<Unit>([target]), first = near(target, hit);
    for (const f of first) { hit.add(f); damage(p, t, attacker.id, f, hard ? 9 : 3, ev, true); if (charged) applyStatus(p, attacker, f, 'shock', t, ev); }
  }
  return m;
}
