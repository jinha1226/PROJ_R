import { addShield } from './shield';
import { alive, damage, entOf, strike } from './partyCore';
import { heal, nearby } from './kitEffects';
import { applyStatus } from './status';
import { trait, type TraitDef } from './traitTypes';
const passive=(id:string,name:string,tags:TraitDef['tags'],fn:TraitDef['passive'])=>trait(id,name,tags,'common',fn);
const trigger=(id:string,name:string,tags:TraitDef['tags'],fn:TraitDef['trigger'])=>trait(id,name,tags,'common',undefined,fn);
export const COMMON: TraitDef[] = [
  passive('tough','강인함',['생존'],(_u,r)=>({hp:.15*r})),
  trait('sprint','질주',['생존'],'common',(_u,r)=>({move:.1*r}),r=>({id:'질주',when:'moved',test:()=>r===3,run:(_p,c)=>{c.src.dodgeNext=true;}})),
  passive('eagle','매의 눈',['원거리'],(_u,r)=>({hit:.05*r,range:r===3?1:0})),
  passive('coverPro','엄폐 숙련',['생존'],(_u,r)=>({cover:-.15*r})),
  passive('firstAid','응급처치',['치유'],(_u,r)=>({regen:.01*r})),
  passive('grit','끈기',['생존'],(_u,r)=>({gritCd:[60,40,20][r-1]!})),
  passive('bond','결속',['협공'],(_u,r)=>({bond:.05*r})),
  passive('resonance','집중',['생존'],(_u,r)=>({cd:-.1*r})),
  trigger('finish','마무리',['치명'],r=>({id:'마무리',when:'kill',run:(_p,c)=>{c.src.empower=Math.max(c.src.empower,1.5+.25*(r-1));}})),
  trigger('reflex','반사 신경',['생존'],()=>({id:'반사 신경',when:'dodge',run:(_p,c)=>{c.src.nextCrit=true;}})),
  trigger('anger','분노',['근접'],r=>({id:'분노',when:'struck',run:(_p,c)=>{c.src.furyStacks=Math.min(3,(c.t<(c.src.furyUntil??0)?c.src.furyStacks??0:0)+1);c.src.furyUntil=c.t+3;c.src.furyPower=.1*r;}})),
  trigger('combo','연타',['근접'],r=>({id:'연타',when:'nth',nth:3,run:(p,c)=>{if(c.target)strike(p,c.src,c.target,c.t,c.ev,1+.25*(r-1),false);}})),
  trigger('unyielding','불굴',['생존'],r=>({id:'불굴',when:'crisis',run:(_p,c)=>{addShield(c.src, 20+10*(r-1));}})),
  trigger('morale','사기',['협공'],r=>({id:'사기',when:'kill',run:(p,c)=>{for(const a of nearby(p,c.src,2))if(!c.src.traits?.loneWolf)heal(p,c.src,a,4*r,c.t,c.ev);}})),
  trigger('initiative','선제',['치명'],r=>({id:'선제',when:'combatStart',run:(_p,c)=>{c.src.nextAt=c.t;c.src.empower=Math.max(c.src.empower,1+.2*r);}})),
  trigger('absorb','흡수',['치유'],r=>({id:'흡수',when:'hit',run:(p,c)=>heal(p,c.src,c.src,(c.amount??0)*.05*r,c.t,c.ev)})),
  passive('weakness','약점 간파',['치명'],(_u,r)=>({crit:.05*r})),
  passive('cruel','잔혹',['치명'],(_u,r)=>({critDmg:.25*r})),
  passive('pursuit','추격',['근접'],()=>({})),
  passive('endure','버티기',['방패'],(u,r)=>({taken:u.still>=2?-.1*r:0})),
  passive('seasoned','노련함',['생존'],(_u,r)=>({xp:.1*r})),
  passive('plunder','약탈자',['생존'],(_u,r)=>({bio:.25*r})),
  trigger('openWound','상처 벌리기',['출혈'],()=>({id:'상처 벌리기',when:'crit',run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'bleed',c.t,c.ev);}})),
  trigger('spark','불씨',['화염'],r=>({id:'불씨',when:'hit',chance:.15+.1*(r-1),run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'burn',c.t,c.ev);}})),
];
// Shared advanced helpers avoid embedding simulation logic in data tables.
export const splash = (id:string,name:string,tags:TraitDef['tags'],pool:TraitDef['pool']): TraitDef => trait(id,name,tags,pool,undefined,r=>({id:name,when:'kill',run:(p,c)=>{if(c.target)for(const f of nearby(p,c.target,1))if(alive(p,f))damage(p,c.t,c.src.id,f,4*r,c.ev);}}));
export const teleportStrike: TraitDef['trigger'] = r=>({id:'칼춤',when:'kill',run:(p,c)=>{const f=nearby(p,c.src,2,'foe')[0];if(f&&entOf(p,f.id)!.alive){c.src.empower=Math.max(c.src.empower,1+.25*r);c.src.blinkNext=true;}}});
