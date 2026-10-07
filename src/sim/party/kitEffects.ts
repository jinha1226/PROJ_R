import type { WeaponId } from './partyDefs';
import { emit } from './triggers';
import { T } from './traitMods';
import { G } from '../delve/gear';
import { spawnFoe } from '../grid/foes';
import { DIRS, dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, type Party, type Unit } from './partyCore';
import { resonant } from './resonance';
export const nearby = (p: Party, u: Unit, radius: number, side = u.side) => p.units.filter(x => x.side === side && alive(p, x) && dist(posOf(p, x), posOf(p, u)) <= radius);
export function heal(p: Party, src: Unit, dst: Unit, amount: number, t: number, ev: GEvent[]): void {
  if (!alive(p, src) || !alive(p, dst)) return;
  amount *= T.heal(src)*G.healTaken(dst);
  const e = entOf(p, dst.id)!, n = Math.min(e.maxHp - e.hp, Math.round(amount));
  if (n > 0) { e.hp += n; dst.lowHp=e.hp<e.maxHp/2; }
  if (amount > n) emit(p,'overflow',{t,src,target:dst,amount:Math.max(0,Math.round(amount)-n),ev});
  ev.push({ t, type: 'heal', src: src.id, dst: dst.id, amount: n });
  emit(p,'healed',{t,src,target:dst,amount:n,ev});
}
export function fireball(p: Party, src: Unit, dst: Unit, t: number, ev: GEvent[]): void {
  for (const f of nearby(p, dst, 1)) {
    damage(p, t, src.id, f, Math.round(p.s.rng.int(10, 14)*T.amplify(src)), ev);
    emit(p,'fireball',{t,src,target:f,ev});
  }
}
/** what a summon is: health, weapon, how long it stays (Infinity: until it falls), whether it is a golem */
export interface SummonOpts { hp?: number; weapon?: WeaponId; life?: number; golem?: boolean; count?: (u: Unit) => boolean }
export function summon(p: Party, src: Unit, at: Cell, t: number, ev: GEvent[], cap = 2, o: SummonOpts = {}): boolean {
  const mine = (x: Unit) => x.summoner === src.id && alive(p, x) && (o.count ? o.count(x) : !x.golem && !x.mirror);
  if (!alive(p, src) || p.units.filter(mine).length >= cap + (resonant(p, src, '소환', 1) ? 1 : 0)) return false;
  const spot = DIRS.map(d => ({ x: at.x + d.x, y: at.y + d.y })).find(c => walkable(tileAt(p.s.map, c)) && !occupied(p, c, ''));
  if (!spot) return false;
  const e = spawnFoe(p.s, 'minion', spot, false); e.hp = e.maxHp = o.hp ?? 18;
  p.units.push({ id: e.id, side: 'hero', cls: 'shell', weapon: o.weapon ?? 'fists', status: {}, trig: {}, nth: 0, still: 0, crisisUsed: false, ultReady: 0, nextAt: t + 0.5, order: null, ready: [0, 0], tauntUntil: 0, shield: 0, hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0, summoner: src.id, summonedUntil: t + (o.life ?? 10), ...(o.golem ? { golem: true } : {}) });
  ev.push({ t, type: 'summon', src: src.id, dst: e.id, to: spot });
  emit(p, 'summon', { t, src, target: p.units[p.units.length - 1], ev });
  return true;
}

export function expireSummons(p: Party, t: number): void {
  const expired = new Set(p.units.filter(u => u.summoner && (!alive(p, u) || (u.summonedUntil ?? Infinity) <= t)).map(u => u.id));
  p.units = p.units.filter(u => !expired.has(u.id));
  p.s.foes = p.s.foes.filter(e => !expired.has(e.id));
}
