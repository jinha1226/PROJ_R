import { promotionOptions } from './classKit';
import { G } from '../delve/gear';
import type { GEvent } from '../grid/types';
import { alive, entOf, type Party, type Unit } from './partyCore';
import { BASE_CLASSES, CLASSES, type BaseClass } from './partyDefs';
import { MAX_RANK, PROMOTE_LEVEL, T, TRAITS, rank, type TraitId } from './partyTraits';
export { PROMOTE_LEVEL };

/** experience needed to reach each level (index 0 = level 1) */
export const LEVEL_XP = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 490, 590, 700, 820];
export const MAX_LEVEL = LEVEL_XP.length;
/** health a level adds */
const HP_PER_LEVEL = 4;
const XP: Record<string, number> = { goblin: 4, archer: 4, brute: 10, ghoul: 4, shaman: 6, warlord: 60 };

export const levelOf = (u: Unit): number => u.level ?? 1;
/** the base class whose traits a clone may take (an advanced class keeps its base's) */
const lineOf = (u: Unit): BaseClass | undefined => u.soul ?? (BASE_CLASSES.includes(u.cls as BaseClass) ? u.cls as BaseClass : undefined);

/** Health from class, level and the toughness trait (current health keeps its gap to the top). */
export function refitHp(p: Party, u: Unit): void {
  const e = entOf(p, u.id);
  if (!e || !u.cls) return;
  const max = Math.round(((u.cls === 'veteran' && u.soul ? CLASSES[u.soul].hp * 1.15 : CLASSES[u.cls].hp) + HP_PER_LEVEL * (levelOf(u) - 1)) * T.hp(u)) + G.hp(u);
  e.hp = Math.max(e.alive ? 1 : 0, e.hp + (max - e.maxHp));
  e.maxHp = max;
}

/** Three traits to choose from: the common ones and the clone's own line's, none already at full rank. */
export function rollOffer(p: Party, u: Unit): TraitId[] {
  const line = lineOf(u);
  const pool = (Object.keys(TRAITS) as TraitId[]).filter((id) => (!TRAITS[id].cls || TRAITS[id].cls === line) && rank(u, id) < MAX_RANK);
  return p.s.rng.shuffle(pool).slice(0, 3);
}

/** Experience for a clone: each level adds health and a trait to pick; the advanced class opens at its level. */
export function gainXp(p: Party, u: Unit, n: number, ev: GEvent[]): void {
  if (!u.cls || u.cls === 'shell') return;
  u.xp = (u.xp ?? 0) + n;
  while (levelOf(u) < MAX_LEVEL && u.xp >= LEVEL_XP[levelOf(u)]!) {
    u.level = levelOf(u) + 1;
    u.picks = (u.picks ?? 0) + 1;
    refitHp(p, u);
    ev.push({ t: p.time, type: 'levelUp', src: u.id, dst: u.id, amount: u.level });
  }
  if (u.picks && !u.offer?.length) u.offer = rollOffer(p, u);
  u.promoteReady = promotionOptions(p,u).some(o=>o.met);
}

/** Fallen foes give experience to the clones fighting near them. */
export function awardXp(p: Party, fallen: Unit, ev: GEvent[]): void {
  const at = entOf(p, fallen.id)!;
  const n = (XP[fallen.foe ?? ''] ?? 4) * (at.elite ? 2 : 1);
  for (const u of p.units) {
    const e = entOf(p, u.id);
    if (u.side !== 'hero' || !e || !alive(p, u)) continue;
    if (Math.max(Math.abs(e.pos.x - at.pos.x), Math.abs(e.pos.y - at.pos.y)) <= 12) gainXp(p, u, n, ev);
  }
}

/** The player picks one of the offered traits: its rank goes up (toughness refits health), the next offer comes if picks are left. */
export function pickTrait(p: Party, id: string, trait: TraitId): GEvent[] {
  const u = p.units.find((x) => x.id === id);
  if (!u || !u.picks || !u.offer?.includes(trait)) return [];
  u.traits = { ...u.traits, [trait]: rank(u, trait) + 1 };
  u.picks--;
  if (trait === 'tough') refitHp(p, u);
  u.offer = u.picks ? rollOffer(p, u) : undefined;
  return [{ t: p.time, type: 'buff', src: id, dst: id, text: 'trait' }];
}
