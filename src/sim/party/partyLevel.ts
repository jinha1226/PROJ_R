import { rollOffer } from './traitPool';
import { G } from '../delve/gear';
import type { GEvent } from '../grid/types';
import { alive, entOf, type Party, type Unit } from './partyCore';
import { CLASSES } from './partyDefs';
import { TRAITS, rank, type TraitId } from './traitDefs';
import { T } from './traitMods';
import { linesOf } from './body';

/** experience needed to reach each level (index 0 = level 1) */
export const LEVEL_XP = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 490, 590, 700, 820];
export const MAX_LEVEL = LEVEL_XP.length;
const XP: Record<string, number> = { goblin: 4, archer: 4, brute: 10, ghoul: 4, shaman: 6, warlord: 60 };

export const levelOf = (u: Unit): number => u.level ?? 1;
/** Health from class, level and the toughness trait (current health keeps its gap to the top). */
export function refitHp(p: Party, u: Unit): void {
  const e = entOf(p, u.id);
  if (!e || !u.cls) return;
  const base = Math.max(CLASSES[u.cls].hp, ...linesOf(u).map((c) => CLASSES[c].hp));
  const max = Math.round((base * (1 + 0.08 * (levelOf(u) - 1))) * T.hp(u)) + G.hp(u);
  e.hp = Math.max(e.alive ? 1 : 0, e.hp + (max - e.maxHp));
  e.maxHp = max;
}

export { rollOffer } from './traitPool';
/** Experience for a clone: each level adds health and a trait to pick; the advanced class opens at its level. */
export function gainXp(p: Party, u: Unit, n: number, ev: GEvent[]): void {
  if (!u.cls) return;
  u.xp = (u.xp ?? 0) + Math.round(n);
  u.pendingKeystones ??= 0;
  while (levelOf(u) < MAX_LEVEL && u.xp >= LEVEL_XP[levelOf(u)]!) {
    u.level = levelOf(u) + 1;
    if ([10,14].includes(u.level)) u.pendingKeystones++;
    u.picks = (u.picks ?? 0) + 1;
    refitHp(p, u);
    ev.push({ t: p.time, type: 'levelUp', src: u.id, dst: u.id, amount: u.level });
  }
  if (u.picks && !u.offer?.length) offerNext(p, u);
}

/** Fallen foes give experience to the clones fighting near them (on the surface, only to clones that have been down: a fresh body stays ready for souls). */
export function awardXp(p: Party, fallen: Unit, ev: GEvent[]): void {
  const at = entOf(p, fallen.id)!;
  const n = (XP[fallen.foe ?? ''] ?? 4) * (at.elite ? 2 : 1) * (fallen.fodder ? 0.5 : 1);
  for (const u of p.units) {
    const e = entOf(p, u.id);
    if (u.side !== 'hero' || !e || !alive(p, u)) continue;
    if ((p as { printHere?: boolean }).printHere && !u.wentDown) continue;
    if (Math.max(Math.abs(e.pos.x - at.pos.x), Math.abs(e.pos.y - at.pos.y)) <= 12) gainXp(p, u, n, ev);
  }
}

/** Rolls the next offer; with nothing left to offer, the remaining picks are spent rather than left waiting. */
function offerNext(p: Party, u: Unit): void {
  u.offer = rollOffer(p, u);
  if (!u.offer.length) { u.picks = 0; u.offer = undefined; }
}

/** The player picks one of the offered traits: its rank goes up (toughness refits health), the next offer comes if picks are left. */
export function pickTrait(p: Party, id: string, trait: TraitId): GEvent[] {
  const u = p.units.find((x) => x.id === id);
  if (!u || !u.picks || !u.offer?.includes(trait) || !TRAITS[trait] || rank(u,trait)>=TRAITS[trait]!.ranks || (TRAITS[trait]!.pool==='keystone' && Object.keys(u.traits??{}).some(id=>TRAITS[id]?.pool==='keystone'))) return [];
  u.traits = { ...u.traits, [trait]: rank(u, trait) + 1 };
  u.picks--;
  if(TRAITS[trait]?.passive)refitHp(p,u);
  if (u.picks) offerNext(p, u); else u.offer = undefined;
  return [{ t: p.time, type: 'buff', src: id, dst: id, text: 'trait' }];
}
