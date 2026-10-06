import { TRAITS, rank } from './traitDefs';
import { T } from './traitMods';
import { dist, type GEvent } from '../grid/types';
import { alive, damage, entOf, posOf, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { CLASSES, BASE_CLASSES, WEAPONS, type BaseClass, type ClassId, type WeaponId } from './partyDefs';
import type { Tag, WeaponFamily } from './buildTypes';
import type { TriggerDef } from './triggers';
import { heal, nearby, fireball, summon } from './kitEffects';
import { applyStatus } from './status';
import { refitHp } from './partyLevel';
export type UltId = 'warcry' | 'arrowRain' | 'meteor' | 'sanctum' | 'shadowDance' | 'bloodFrenzy' | 'bastion' | 'pierceShot' | 'bleedRain' | 'elementStorm' | 'deadHost' | 'judgement' | 'longSanctum' | 'deathDance' | 'toxicFog';
export interface Kit { innate: TriggerDef[]; ultimate: UltId | null; ultCd: number; proficient: WeaponFamily[] }
export const FAMILY: Record<WeaponId, WeaponFamily | null> = { fists: null, swordShield: 'sword', greataxe: 'great', longbow: 'bow', crossbow: 'crossbow', staff: 'staff', wand: 'staff', mace: 'mace', symbol: 'relic', daggers: 'dagger', knives: 'dagger' };
export function proficient(u: Unit): boolean { const f = u.weapon && FAMILY[u.weapon]; return !!u.cls && !!f && kitOf(u).proficient.includes(f); }
const warrior: TriggerDef[] = [
  { id: '포위 베기', when: 'hit', cd: 6, test: (p,c) => nearby(p,c.src,1+(rank(c.src,'whirlwind')===3?1:0),'foe').length >= 2, run: (p,c) => { for (const f of nearby(p,c.src,1+(rank(c.src,'whirlwind')===3?1:0),'foe')) {damage(p,c.t,c.src.id,f,p.s.rng.int(6,9),c.ev);if(rank(c.src,'bloodBlade'))applyStatus(p,c.src,f,'bleed',c.t,c.ev);} } },
  { id: '응수', when: 'block', test: (_p,c) => !!c.target && !c.target.cls && (c.target.foe !== 'archer' && c.target.foe !== 'shaman'), run: (p,c) => { if (c.target) strike(p,c.src,c.target,c.t,c.ev,T.counter(c.src),false); } },
];
const archer: TriggerDef[] = [
  { id: '기습 사격', when: 'crit', test: (p,c) => !!c.target && entOf(p,c.target.id)!.hp + (c.amount ?? 0) >= entOf(p,c.target.id)!.maxHp, run: () => {} },
  { id: '정조준', when: 'still', run: (_p,c) => { c.src.steady = Math.min(T.steadyMax(c.src),c.src.still); } },
];
const mage: TriggerDef[] = [
  { id: '연쇄 주문', when: 'nth', nth: 3, run: (p,c) => { if (c.target) fireball(p,c.src,c.target,c.t,c.ev); } },
  { id: '파쇄', when: 'hit', test: (_p,c) => !!c.target?.status.freeze, run: () => {} },
];
const cleric: TriggerDef[] = [
  { id: '구원의 손', when: 'allyCrisis', cd: 8, run: (p,c) => { if (c.target) heal(p,c.src,c.target,22,c.t,c.ev); } },
  { id: '축복', when: 'combatStart', run: (p,c) => { for (const u of p.units) if (u.side === 'hero' && alive(p,u)) u.shield += 10+T.ward(c.src); } },
];
const rogue: TriggerDef[] = [
  { id: '배후 급소', when: 'hit', test: (p,c) => !!c.target && targetOf(p,c.target,c.t)?.id !== c.src.id, run: () => {} },
  { id: '잠행', when: 'kill', run: (_p,c) => { c.src.hiddenUntil = c.t + 1+T.stealth(c.src); } },
];
const kit = (innate: TriggerDef[], ultimate: UltId, ultCd: number, proficient: WeaponFamily[]): Kit => ({ innate, ultimate, ultCd, proficient });
const extra = (base: TriggerDef[], def: TriggerDef) => [...base,def];
export const KITS: Record<ClassId, Kit> = {
  shell: { innate: [], ultimate: null, ultCd: 0, proficient: [] },
  warrior: kit(warrior,'warcry',35,['sword','great','mace']), archer: kit(archer,'arrowRain',35,['bow','crossbow']), mage: kit(mage,'meteor',45,['staff']), cleric: kit(cleric,'sanctum',45,['mace','relic']), rogue: kit(rogue,'shadowDance',35,['dagger']),
  berserker: kit(extra(warrior,{ id: '광분', when: 'crisis', run: () => {} }),'bloodFrenzy',35,['sword','great','mace']),
  guardian: kit(extra(warrior,{ id: '수호', when: 'allyCrisis', run: () => {} }),'bastion',35,['sword','mace']),
  sniper: kit(extra(archer,{ id: '저격', when: 'hit', run: () => {} }),'pierceShot',35,['bow','crossbow']),
  hunter: kit(extra(archer,{ id: '속박', when: 'hit', chance: 0.25, run: (p,c) => { if(c.target) applyStatus(p,c.src,c.target,'freeze',c.t,c.ev); } }),'bleedRain',35,['bow','crossbow','dagger']),
  elementalist: kit(extra(mage,{ id: '원소 연쇄', when: 'nth', nth: 3, run: () => {} }),'elementStorm',45,['staff']),
  necromancer: kit(extra(mage,{ id: '해골', when: 'kill', run: (p,c) => { if(c.target) summon(p,c.src,posOf(p,c.target),c.t,c.ev); } }),'deadHost',45,['staff']),
  inquisitor: kit(extra(cleric,{ id: '심판', when: 'hit', run: (p,c) => { const a = p.units.filter(x=>x.side==='hero' && alive(p,x)).sort((a,b)=>entOf(p,a.id)!.hp/entOf(p,a.id)!.maxHp-entOf(p,b.id)!.hp/entOf(p,b.id)!.maxHp)[0]; if(a) heal(p,c.src,a,2,c.t,c.ev); } }),'judgement',45,['mace','relic']),
  healer: kit(extra(cleric,{ id: '넘치는 빛', when: 'allyCrisis', run: () => {} }),'longSanctum',45,['mace','relic']),
  assassin: kit(extra(rogue,{ id: '처형술', when: 'hit', run: () => {} }),'deathDance',35,['dagger']),
  toxicologist: kit(extra(rogue,{ id: '독술', when: 'hit', run: (p,c) => { if(c.target) applyStatus(p,c.src,c.target,'poison',c.t,c.ev); } }),'toxicFog',35,['dagger']),
  veteran: { innate: [], ultimate: null, ultCd: 0, proficient: ['sword','great','mace','bow','crossbow','staff','relic','dagger'] },
};
export const LINE: Partial<Record<ClassId, BaseClass>> = { berserker:'warrior', guardian:'warrior', sniper:'archer', hunter:'archer', elementalist:'mage', necromancer:'mage', inquisitor:'cleric', healer:'cleric', assassin:'rogue', toxicologist:'rogue' };
export function kitOf(u: Unit): Kit { return u.cls === 'veteran' && u.soul ? { ...KITS[u.soul], ultCd: KITS[u.soul].ultCd * 0.8 } : KITS[u.cls ?? 'shell']; }
export function kitMult(p: Party,u: Unit,target: Unit,t: number): number {
  if (!proficient(u)) return u.cls === 'veteran' ? 1.1 : 1;
  const base = u.cls === 'veteran' ? u.soul : LINE[u.cls!] ?? u.cls;
  let m = u.cls === 'veteran' ? 1.1 : 1;
  if (base === 'archer') m *= 1 + 0.1 * (u.steady ?? 0);
  if (base === 'rogue' && targetOf(p,target,t)?.id !== u.id) m *= 1.6;
  if (u.cls === 'sniper' && dist(posOf(p,u),posOf(p,target)) > 5) m *= 2;
  if (u.cls === 'assassin' && entOf(p,target.id)!.hp < entOf(p,target.id)!.maxHp * 0.35) m *= 2;
  return m;
}
export interface PromotionRule { to: ClassId; need: Partial<Record<Tag,number>>; wear?: WeaponFamily | 'shield'; anyElements?: number }
export const PROMOTIONS: Record<BaseClass,PromotionRule[]> = {
  warrior:[{to:'berserker',need:{근접:4,출혈:2}},{to:'guardian',need:{방패:4},wear:'shield'}], archer:[{to:'sniper',need:{치명:4},wear:'crossbow'},{to:'hunter',need:{출혈:2,독:2}}], mage:[{to:'elementalist',need:{화염:1,냉기:1,전기:1},anyElements:3},{to:'necromancer',need:{소환:3}}], cleric:[{to:'inquisitor',need:{방패:2,근접:2},wear:'mace'},{to:'healer',need:{치유:4}}], rogue:[{to:'assassin',need:{은신:2,치명:3}},{to:'toxicologist',need:{독:4}}],
};
export function tagsOf(u: Unit): Partial<Record<Tag,number>> {
  const tags: Partial<Record<Tag,number>> = {};
  for(const [id,rank] of Object.entries(u.traits ?? {})) for(const tag of TRAITS[id]?.tags ?? []) tags[tag]=(tags[tag]??0)+(rank??0);
  if(u.weapon === 'crossbow') tags.치명=(tags.치명??0)+1;
  if(u.weapon && WEAPONS[u.weapon].shield) tags.방패=(tags.방패??0)+1;
  return tags;
}
export function promotionOptions(_p: Party,u: Unit): {to:ClassId;met:boolean;have:Partial<Record<Tag,number>>}[] {
  if(!BASE_CLASSES.includes(u.cls as BaseClass)) return [];
  const have=tagsOf(u), rules=PROMOTIONS[u.cls as BaseClass];
  const options=rules.map(r=>({to:r.to,have,met:(u.level??1)>=8 && Object.entries(r.need).every(([tag,n])=>(have[tag as Tag]??0)>=n) && (!r.wear || (r.wear==='shield' ? !!WEAPONS[u.weapon??'fists'].shield : FAMILY[u.weapon??'fists']===r.wear))}));
  return [...options,{to:'veteran',have,met:(u.level??1)>=10 && !options.some(o=>o.met)}];
}
export function promote(p: Party,id: string,to: ClassId): GEvent[] {
  const u=unitOf(p,id); if(!u || !alive(p,u) || !promotionOptions(p,u).some(o=>o.to===to&&o.met)) return [];
  u.soul ??= u.cls as BaseClass; u.cls=to; u.promoteReady=false; refitHp(p,u);
  return [{t:p.time,type:'buff',src:id,dst:id,text:CLASSES[to].name}];
}
