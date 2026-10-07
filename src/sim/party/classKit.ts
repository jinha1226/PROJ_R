import { addShield } from './shield';
import { TRAITS } from './traitDefs';
import { T } from './traitMods';
import { dist } from '../grid/types';
import { alive, damage, entOf, posOf, targetOf, type Party, type Unit } from './partyCore';
import { WEAPONS, type ClassId, type WeaponId } from './partyDefs';
import type { Tag, WeaponFamily } from './buildTypes';
import type { TriggerDef } from './triggers';
import { heal, nearby, summon } from './kitEffects';
export type UltId = 'earthSlam' | 'arrowRain' | 'teleport' | 'sanctum' | 'shadowClone' | 'golem' | 'gravity';
export interface Kit { innate: TriggerDef[]; ultimate: UltId | null; ultCd: number; proficient: WeaponFamily[] }
export const FAMILY: Record<WeaponId, WeaponFamily | null> = { fists: null, pistol: 'gun', swordShield: 'sword', greataxe: 'great', longbow: 'bow', crossbow: 'crossbow', staff: 'staff', wand: 'staff', mace: 'mace', symbol: 'relic', daggers: 'dagger', knives: 'dagger' };
export { proficient } from '../delve/gear';
import { proficient, worn } from '../delve/gear';
import { CATALOG } from '../delve/catalog';
import { counter } from './cardFx';
import { consume, isCorpse } from './corpses';
import { SHELL_INNATE } from './cardsShell';
import { MAGE_INNATE } from './cardsMage';
import { GOLEM_FALL } from './cardsNecro';
import { MIRROR_STRIKE } from './cardsRogue';
import { whirlwind } from './cardsWarrior';
import { duoFor } from './cardsCombo';
import { sfTags } from '../base/workshop';
import { MEMORIES } from './memories';
import { linesOf, memoriesOf } from './body';
/** how far the whirlwind reaches (cells) */
export const WHIRL_REACH = 4;
const warrior: TriggerDef[] = [
  // the whirlwind: two blows taken within a turn and the warrior spins, cutting every foe within four cells (once a turn)
  { id: '회오리 베기', when: 'struck', cd: 1, test: (_p,c) => (c.src.struckTimes?.length ?? 0) >= 2, run: (p,c) => { c.src.struckTimes = []; whirlwind(p, c.src, c.t, c.ev); } },
  { id: '응수', when: 'block', test: (_p,c) => !!c.target && !c.target.cls && (c.target.foe !== 'archer' && c.target.foe !== 'shaman'), run: (p,c) => { if (c.target) counter(p,c.src,c.target,c.t,c.ev,T.counter(c.src)); } },
];
const archer: TriggerDef[] = [
  { id: '기습 사격', when: 'beforeHit', test: (p,c) => !!c.target && entOf(p,c.target.id)!.hp === entOf(p,c.target.id)!.maxHp, run: (_p,c) => { c.src.nextCrit = true; } },
  { id: '정조준', when: 'still', run: (_p,c) => { c.src.steady = Math.min(T.steadyMax(c.src),c.src.still); } },
];
const cleric: TriggerDef[] = [
  // the hand of salvation: the cleric itself or one of its minions in crisis is healed (one cooldown for both)
  { id: '구원의 손', when: 'allyCrisis', cd: 8, run: (p,c) => { if (c.target) heal(p,c.src,c.target,22,c.t,c.ev); } },
  { id: '구원의 손', when: 'crisis', cd: 8, run: (p,c) => heal(p,c.src,c.src,22,c.t,c.ev) },
  { id: '축복', when: 'combatStart', run: (p,c) => { for (const u of p.units) if (u.side === 'hero' && alive(p,u)) addShield(u, 10+T.ward(c.src)); } },
];
const rogue: TriggerDef[] = [
  { id: '배후 급소', when: 'beforeHit', test: (p,c) => !!c.target && targetOf(p,c.target,c.t)?.id !== c.src.id, run: (_p,c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 1.6; } },
  { id: '잠행', when: 'kill', run: (_p,c) => { c.src.hiddenUntil = c.t + 1+T.stealth(c.src); } },
];
/** the necromancer's innates (C3 spec §3.6): a fifth of kills raise a skeleton from the body; every other body bursts (bone damage, repeat) */
const necromancer: TriggerDef[] = [
  { id: '망자의 부름', when: 'kill', chance: 0.2, test: (p,c) => !!c.target && isCorpse(p,c.target), run: (p,c) => { if (summon(p,c.src,posOf(p,c.target!),c.t,c.ev)) consume(c.target!); } },
  { id: '시체 폭발', when: 'kill', repeat: true, test: (p,c) => !!c.target && isCorpse(p,c.target), run: (p,c) => {
    const body = c.target!, at = posOf(p, body), amount = Math.max(1, Math.round(entOf(p, body.id)!.maxHp * 0.15));
    consume(body);
    for (const f of nearby(p, body, 1, 'foe')) if (dist(posOf(p, f), at) <= 1) damage(p, c.t, c.src.id, f, amount, c.ev, true, false, 'bone');
    // the cleric-necromancer combo: every burst shields the necromancer
    if (duoFor(p, c.src, 'lifeCycle')) addShield(c.src, 3, c.src);
  } },
];
const kit = (innate: TriggerDef[], ultimate: UltId, ultCd: number, proficient: WeaponFamily[]): Kit => ({ innate, ultimate, ultCd, proficient });
export const KITS: Record<ClassId, Kit> = {
  // the innates are read on use: the card module and this one import each other
  shell: { get innate() { return SHELL_INNATE; }, ultimate: 'gravity', ultCd: 35, proficient: ['gun'] },
  warrior: kit(warrior,'earthSlam',35,['sword','great','mace']), archer: kit(archer,'arrowRain',35,['bow','crossbow']), mage: { get innate() { return MAGE_INNATE; }, ultimate: 'teleport', ultCd: 30, proficient: ['staff'] }, cleric: kit(cleric,'sanctum',45,['mace','relic']), rogue: { get innate() { return [...rogue, MIRROR_STRIKE]; }, ultimate: 'shadowClone', ultCd: 35, proficient: ['dagger'] },
  necromancer: { get innate() { return [...necromancer, GOLEM_FALL]; }, ultimate: 'golem', ultCd: 40, proficient: ['staff'] },
};
export function kitOf(u: Unit): Kit { return KITS[u.cls ?? 'shell']; }
/** the kits of every soul in the body (none for the empty body); a unit given a class directly uses that class's kit */
export const kitsOf = (u: Unit): Kit[] => (u.souls?.length ? linesOf(u).map((c) => KITS[c]) : [KITS[u.cls ?? 'shell']]);
export function kitMult(p: Party,u: Unit,target: Unit,t: number): number {
  if (!proficient(u)) return 1;
  let m = 1;
  if (linesOf(u).includes('archer')) m *= 1 + 0.1 * (u.steady ?? 0);
  void p; void target; void t;
  return m;
}
export function tagsOf(u: Unit): Partial<Record<Tag,number>> {
  const tags: Partial<Record<Tag,number>> = {};
  for(const [id,rank] of Object.entries(u.traits ?? {})) for(const tag of TRAITS[id]?.tags ?? []) tags[tag]=(tags[tag]??0)+(rank?1:0);
  for (const m of memoriesOf(u)) tags[MEMORIES[m].tag] = (tags[MEMORIES[m].tag] ?? 0) + 1;
  if(u.gear) {for(const it of worn(u))for(const tag of CATALOG[it.def]!.tags)tags[tag]=(tags[tag]??0)+1;}
  else {if(u.weapon==='crossbow')tags.치명=(tags.치명??0)+1;if(u.weapon&&WEAPONS[u.weapon].shield)tags.방패=(tags.방패??0)+1;}
  for (const tag of sfTags(u)) tags[tag] = (tags[tag] ?? 0) + 1;
  return tags;
}
