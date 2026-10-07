import { addShield } from './shield';
import { TRAITS } from './traitDefs';
import { T } from './traitMods';
import { dist } from '../grid/types';
import { alive, damage, entOf, levelDmg, posOf, stats, targetOf, type Party, type Unit } from './partyCore';
import { WEAPONS, type BaseClass, type ClassId, type WeaponId } from './partyDefs';
import type { Tag, WeaponFamily } from './buildTypes';
import type { TriggerDef } from './triggers';
import { heal, nearby, summon } from './kitEffects';
import { applyStatus } from './status';
export type UltId = 'warcry' | 'arrowRain' | 'meteor' | 'sanctum' | 'shadowDance' | 'bloodFrenzy' | 'bastion' | 'pierceShot' | 'bleedRain' | 'elementStorm' | 'deadHost' | 'judgement' | 'longSanctum' | 'deathDance' | 'toxicFog' | 'gravity' | 'teleport';
export interface Kit { innate: TriggerDef[]; ultimate: UltId | null; ultCd: number; proficient: WeaponFamily[] }
export const FAMILY: Record<WeaponId, WeaponFamily | null> = { fists: null, pistol: 'gun', swordShield: 'sword', greataxe: 'great', longbow: 'bow', crossbow: 'crossbow', staff: 'staff', wand: 'staff', mace: 'mace', symbol: 'relic', daggers: 'dagger', knives: 'dagger' };
export { proficient } from '../delve/gear';
import { proficient, worn } from '../delve/gear';
import { CATALOG } from '../delve/catalog';
import { counter } from './cardFx';
import { consume, isCorpse } from './corpses';
import { SHELL_INNATE } from './cardsShell';
import { MAGE_INNATE } from './cardsMage';
import { sfTags } from '../base/workshop';
import { MEMORIES } from './memories';
import { linesOf, memoriesOf } from './body';
/** how far the whirlwind reaches (cells) */
export const WHIRL_REACH = 4;
const warrior: TriggerDef[] = [
  // the whirlwind: two blows taken within a turn and the warrior spins, cutting every foe within four cells (once a turn)
  { id: '회오리 베기', when: 'struck', cd: 1, test: (_p,c) => (c.src.struckTimes?.length ?? 0) >= 2, run: (p,c) => {
    c.src.struckTimes = [];
    const st = stats(c.src, c.t, p), dmg = Math.max(1, Math.round(((st.dmg[0] + st.dmg[1]) / 2) * levelDmg(c.src) * 0.8)), me = posOf(p, c.src);
    for (const f of nearby(p, c.src, WHIRL_REACH, 'foe')) { const at = posOf(p, f); if (Math.hypot(at.x - me.x, at.y - me.y) <= WHIRL_REACH + 0.5) damage(p, c.t, c.src.id, f, dmg, c.ev); }
  } },
  { id: '응수', when: 'block', test: (_p,c) => !!c.target && !c.target.cls && (c.target.foe !== 'archer' && c.target.foe !== 'shaman'), run: (p,c) => { if (c.target) counter(p,c.src,c.target,c.t,c.ev,T.counter(c.src)); } },
];
const archer: TriggerDef[] = [
  { id: '기습 사격', when: 'beforeHit', test: (p,c) => !!c.target && entOf(p,c.target.id)!.hp === entOf(p,c.target.id)!.maxHp, run: (_p,c) => { c.src.nextCrit = true; } },
  { id: '정조준', when: 'still', run: (_p,c) => { c.src.steady = Math.min(T.steadyMax(c.src),c.src.still); } },
];
const cleric: TriggerDef[] = [
  { id: '구원의 손', when: 'allyCrisis', cd: 8, run: (p,c) => { if (c.target) heal(p,c.src,c.target,22,c.t,c.ev); } },
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
  } },
];
const kit = (innate: TriggerDef[], ultimate: UltId, ultCd: number, proficient: WeaponFamily[]): Kit => ({ innate, ultimate, ultCd, proficient });
const extra = (base: TriggerDef[], def: TriggerDef) => [...base,def];
export const KITS: Record<ClassId, Kit> = {
  // the innates are read on use: the card module and this one import each other
  shell: { get innate() { return SHELL_INNATE; }, ultimate: 'gravity', ultCd: 35, proficient: ['gun'] },
  warrior: kit(warrior,'warcry',35,['sword','great','mace']), archer: kit(archer,'arrowRain',35,['bow','crossbow']), mage: { get innate() { return MAGE_INNATE; }, ultimate: 'teleport', ultCd: 30, proficient: ['staff'] }, cleric: kit(cleric,'sanctum',45,['mace','relic']), rogue: kit(rogue,'shadowDance',35,['dagger']),
  berserker: kit(extra(warrior,{ id: '광분', when: 'struck', test: (p,c) => entOf(p,c.src.id)!.hp < entOf(p,c.src.id)!.maxHp/2, run: (p,c) => { const e = entOf(p,c.src.id)!; c.src.lowHp = e.hp < e.maxHp/2; } }),'bloodFrenzy',35,['sword','great','mace']),
  guardian: kit(extra(warrior,{ id: '수호', when: 'guard', run: (p,c) => { c.src.guardIntercepted = true; damage(p,c.t,c.target?.id ?? '',c.src,c.amount ?? 0,c.ev,true,false,'physical',true); } }),'bastion',35,['sword','mace']),
  sniper: kit(extra(archer,{ id: '저격', when: 'beforeHit', test: (p,c) => !!c.target && dist(posOf(p,c.src),posOf(p,c.target)) >= 5, run: (_p,c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 2; } }),'pierceShot',35,['bow','crossbow']),
  hunter: kit(extra(archer,{ id: '속박', when: 'hit', chance: 0.25, run: (p,c) => { if(c.target) applyStatus(p,c.src,c.target,'freeze',c.t,c.ev); } }),'bleedRain',35,['bow','crossbow','dagger']),
  elementalist: kit(extra(MAGE_INNATE,{ id: '원소 연쇄', when: 'fireball', run: (p,c) => { if(c.target) applyStatus(p,c.src,c.target,p.s.rng.pick(['chill','shock']),c.t,c.ev); } }),'elementStorm',45,['staff']),
  necromancer: kit(necromancer,'deadHost',45,['staff']),
  inquisitor: kit(extra(cleric,{ id: '심판', when: 'hit', run: (p,c) => { const a = p.units.filter(x=>x.side==='hero' && alive(p,x)).sort((a,b)=>entOf(p,a.id)!.hp/entOf(p,a.id)!.maxHp-entOf(p,b.id)!.hp/entOf(p,b.id)!.maxHp)[0]; if(a) heal(p,c.src,a,2,c.t,c.ev); } }),'judgement',45,['mace','relic']),
  healer: kit(extra(cleric,{ id: '넘치는 빛', when: 'overflow', run: (_p,c) => { if(c.target) addShield(c.target,c.amount ?? 0); } }),'longSanctum',45,['mace','relic']),
  assassin: kit(extra(rogue,{ id: '처형술', when: 'beforeHit', test: (p,c) => !!c.target && entOf(p,c.target.id)!.hp < entOf(p,c.target.id)!.maxHp * .35, run: (_p,c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 2; } }),'deathDance',35,['dagger']),
  toxicologist: kit(extra(rogue,{ id: '독술', when: 'hit', run: (p,c) => { if(c.target) applyStatus(p,c.src,c.target,'poison',c.t,c.ev); } }),'toxicFog',35,['dagger']),
};
export const LINE: Partial<Record<ClassId, BaseClass>> = { berserker:'warrior', guardian:'warrior', sniper:'archer', hunter:'archer', elementalist:'mage', inquisitor:'cleric', healer:'cleric', assassin:'rogue', toxicologist:'rogue' };
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
