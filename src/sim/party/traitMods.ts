import type { Unit } from './partyCore';
import { TRAITS, rank, type Mods } from './traitDefs';
export function mods(u:Unit): Partial<Mods> {
  const result:Partial<Mods>={};
  for(const [id,r] of Object.entries(u.traits??{})) {
    if(!r)continue;const values=TRAITS[id]?.passive?.(u,r)??{};
    for(const [key,n] of Object.entries(values)) result[key as keyof Mods]=(result[key as keyof Mods]??0)+n;
  }return result;
}
const value=(u:Unit,key:keyof Mods)=>mods(u)[key]??0;
export const T={
  hp:(u:Unit)=>1+value(u,'hp'),move:(u:Unit)=>1/(1+value(u,'move')),evade:(u:Unit)=>{void u;return 0;},
  hit:(u:Unit)=>value(u,'hit'),range:(u:Unit)=>value(u,'range'),coverTaken:(u:Unit)=>1+value(u,'cover'),
  regen:(u:Unit)=>value(u,'regen'),bond:(u:Unit)=>u.traits?.loneWolf?0:value(u,'bond'),gritCd:(u:Unit)=>value(u,'gritCd'),
  cd:(u:Unit)=>1+value(u,'cd'),block:(u:Unit)=>value(u,'block'),counter:(u:Unit)=>1+value(u,'counter'),
  atk:(u:Unit)=>1/(1+value(u,'atk')),steadyMax:(u:Unit)=>3+value(u,'steadyMax'),amplify:(u:Unit)=>1+value(u,'amplify'),
  flow:(u:Unit)=>rank(u,'flow'),heal:(u:Unit)=>1+value(u,'heal'),ward:(u:Unit)=>value(u,'ward'),
  stealth:(u:Unit)=>value(u,'stealth'),crit:(u:Unit)=>value(u,'crit'),critDmg:(u:Unit)=>1.5+value(u,'critDmg'),
};
