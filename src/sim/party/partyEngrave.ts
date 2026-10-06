import { G } from '../delve/gear';
import { dist, type GEvent } from '../grid/types';
import { alive, damage, entOf, posOf, type Party, type Unit } from './partyCore';

/** Target conditions apply to every hit, including a skill's direct damage. */
export function engravingMult(p: Party, u: Unit, target: Unit, t: number): number {
  let m = 1;
  if (t < (target.exposedUntil ?? 0)) m *= 1.5;
  if (t < (target.markUntil ?? 0) && target.markBy !== u.id) m *= 1.3;
  const e = entOf(p, target.id)!;
  if (G.wears(u, 'executioner') && e.hp < e.maxHp * 0.3) m *= 1.5;
  if (G.wears(u, 'link_shatter') && t < target.frozenUntil) { m *= 2; target.frozenUntil = 0; }
  return m;
}
export function guardLink(p: Party, dst: Unit): Unit | undefined {
  return p.units.find((u) => u !== dst && u.side === 'hero' && alive(p, u) && G.wears(u, 'link_guard') && dist(posOf(p, u), posOf(p, dst)) <= 1);
}
export function echoSkill(p: Party, caster: Unit): void {
  for (const u of p.units) if (u !== caster && u.side === 'hero' && alive(p, u) && G.wears(u, 'link_echo') && dist(posOf(p, u), posOf(p, caster)) <= 3) { u.empower = Math.max(u.empower, 2); u.echoPending = true; }
}
export function basicHit(p: Party, u: Unit, target: Unit, t: number, dealt: number, ev: GEvent[]): void {
  const e = entOf(p, u.id)!;
  if (dealt > 0 && G.wears(u, 'vampire') && e.alive) {
    const amount = Math.min(e.maxHp - e.hp, Math.max(1, Math.round(dealt * 0.15 * G.healTaken(u))));
    e.hp += amount; ev.push({ t, type: 'heal', src: u.id, dst: u.id, amount });
  }
  if (!alive(p, target)) return;
  if (G.wears(u, 'link_mark')) { target.markBy = u.id; target.markUntil = t + 4; }
  if (G.wears(u, 'ember') && p.s.rng.chance(0.25)) {
    target.dotAt = t < (target.burnUntil ?? 0) ? target.dotAt : t + 1;
    target.burnUntil = t + 3; target.burnBy = u.id;
  }
  if (G.wears(u, 'frostbite') && p.s.rng.chance(0.2)) target.nextAt = Math.max(t, target.nextAt) + 1;
}
/** Called at chronological action boundaries, including idle time. */
export function tickBurns(p: Party, until: number, ev: GEvent[]): void {
  for (const u of p.units) while (alive(p, u) && u.dotAt !== undefined && u.dotAt <= until && u.dotAt <= (u.burnUntil ?? 0)) {
    damage(p, u.dotAt, u.burnBy ?? '', u, 3, ev, true);
    u.dotAt++;
  }
}
