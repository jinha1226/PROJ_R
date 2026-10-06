import { tickTraitRegen } from './traitCombat';
import { mods } from './traitMods';
import { alive, damage, posOf, type Party, type Unit } from './partyCore';
import { dist, type GEvent } from '../grid/types';
import { emit } from './triggers';
export type StatusId = 'burn' | 'chill' | 'freeze' | 'poison' | 'shock' | 'bleed' | 'stun' | 'mark' | 'exposed';
export interface Status { until: number; stacks?: number; by?: string; next?: number }
const duration: Record<StatusId, number> = { burn: 3, chill: 3, freeze: 2, poison: 4, shock: Infinity, bleed: 4, stun: 1, mark: 4, exposed: 3 };
export function applyStatus(p: Party, src: Unit, target: Unit, id: StatusId, t: number, ev: GEvent[], stacks = 1, spread = false): void {
  if (!alive(p, src) || !alive(p, target)) return;
  const old = target.status[id];
  target.status[id] = { until: t + duration[id], by: src.id, stacks: id === 'poison' ? Math.min(5+(mods(src).poisonCap??0), (old && old.until > t ? old.stacks ?? 0 : 0) + stacks) : stacks, next: old && old.until > t ? old.next : t + 1 };
  if (id === 'freeze' || id === 'stun') target.nextAt = Math.max(target.nextAt, t + duration[id]);
  ev.push({ t, type: 'buff', src: src.id, dst: target.id, text: id });
  if((id==='shock'||id==='bleed') && target.status.bleed && (target.status.shock?.until??0)>t) {target.status.bleed.stacks=2;ev.push({t,type:'react',src:src.id,dst:target.id,text:'혈전'});}
  emit(p, 'statusApplied', { t, src, target, status: id, ev });
  if (!spread && (id === 'burn' || id === 'poison') && (target.status.burn?.until ?? 0) > t && (target.status.poison?.until ?? 0) > t) {
    ev.push({ t, type: 'react', src: src.id, dst: target.id, text: '독연 폭발' });
    for (const f of p.units) if (f !== target && f.side === target.side && alive(p, f) && dist(posOf(p, f), posOf(p, target)) <= 1) applyStatus(p, src, f, 'poison', t, ev, 2, true);
  }
}
export function tickStatuses(p: Party, _from: number, to: number, ev: GEvent[]): void {
  tickTraitRegen(p,_from,to,ev);
  for (const u of p.units) {
    for (const id of ['burn', 'poison'] as const) {
      const s = u.status[id];
      if (!s) continue;
      while (alive(p, u) && (s.next ?? Infinity) <= Math.min(to, s.until)) {
        damage(p, s.next!, s.by ?? '', u, id === 'burn' ? 3 : 2 * (s.stacks ?? 1), ev, true); s.next!++;
      }
    }
    for (const id of Object.keys(u.status) as StatusId[]) if (u.status[id]!.until <= to) delete u.status[id];
  }
}
export function movedStatus(p: Party, u: Unit, t: number, ev: GEvent[]): void {
  const s = u.status.bleed;
  if (s && t < s.until) damage(p, t, s.by ?? '', u, 4*(s.stacks??1), ev, true);
}
export function statusMult(p: Party, attacker: Unit, target: Unit, heavy: boolean, t: number, ev: GEvent[]): number {
  let m = 1;
  if ((target.status.freeze?.until ?? 0) > t && heavy) { m *= 2; delete target.status.freeze; ev.push({ t, type: 'react', src: attacker.id, dst: target.id, text: '파쇄' }); }
  if ((target.status.mark?.until ?? 0) > t && target.status.mark?.by !== attacker.id) m *= 1.3;
  if ((target.status.exposed?.until ?? 0) > t) m *= 1.5;
  if ((target.status.shock?.until ?? 0) > t) {
    delete target.status.shock;
    for (const f of p.units) if (f !== target && f.side === target.side && alive(p, f) && dist(posOf(p, f), posOf(p, target)) <= 2) damage(p, t, attacker.id, f, 3, ev, true);
  }
  return m;
}
