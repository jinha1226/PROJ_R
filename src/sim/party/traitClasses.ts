import { alive, canHit, damage, entOf, posOf, stepToward, strike } from './partyCore';
import { dist } from '../grid/types';
import { heal, nearby } from './kitEffects';
import { applyStatus } from './status';
import { trait, type TraitDef } from './traitTypes';
export const CLASS_TRAITS: TraitDef[] = [
  trait('whirlwind','회오리',['근접','방패'],'warrior',(_u,r)=>({whirlCd:-r,whirlRange:r===3?1:0})),
  trait('bloodBlade','피의 칼날',['근접','출혈'],'warrior',()=>({})),
  trait('shieldPro','철벽',['방패'],'warrior',(_u,r)=>({block:.1*r})),
  trait('riposte','보복',['근접','방패'],'warrior',(_u,r)=>({counter:.5*r})),
  trait('charge','진격',['근접'],'warrior',undefined,()=>({id:'진격',when:'kill',run:(p,c)=>{const f=nearby(p,c.src,3,'foe')[0];if(f){stepToward(p,c.src,posOf(p,f),c.t,c.ev);if(alive(p,c.src)&&canHit(p,c.src,f))strike(p,c.src,f,c.t,c.ev,1,false);}}})),
  trait('warEcho','함성의 메아리',['협공','근접'],'warrior',undefined,r=>({id:'함성의 메아리',when:'ultimate',run:(p,c)=>{for(const a of p.units.filter(x=>x.side==='hero')){a.damageBuff=1.2+.1*(r-1);a.damageBuffUntil=c.t+3;}}})),
  trait('rapid','속사',['원거리'],'archer',(_u,r)=>({atk:.1*r})),
  trait('piercing','관통 화살',['원거리','치명'],'archer',undefined,r=>({id:'관통 화살',when:'crit',run:(p,c)=>{if(!c.target)return;const me=posOf(p,c.src),at=posOf(p,c.target);const behind={x:at.x+Math.sign(at.x-me.x),y:at.y+Math.sign(at.y-me.y)};for(const f of nearby(p,c.target,1))if(f!==c.target&&dist(posOf(p,f),behind)===0)damage(p,c.t,c.src.id,f,(c.amount??0)*(1+.25*(r-1)),c.ev);}})),
  trait('steady','확고한 손',['원거리','치명'],'archer',(_u,r)=>({steadyMax:3*r})),
  trait('huntMark','사냥감 표시',['원거리','협공'],'archer',undefined,()=>({id:'사냥감 표시',when:'crit',test:(p,c)=>!!c.target&&entOf(p,c.target.id)!.hp+(c.amount??0)>=entOf(p,c.target.id)!.maxHp,run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'mark',c.t,c.ev);}})),
  trait('retreat','후퇴 사격',['원거리'],'archer',(_u,r)=>({retreat:.4+.2*(r-1)})),
  trait('arrowShower','화살 세례',['원거리'],'archer',()=>({})),
  trait('amplify','원소 증폭',['화염','냉기','전기'],'mage',(_u,r)=>({amplify:.15*r})),
  trait('quickChant','빠른 영창',['화염'],'mage',()=>({})),
  trait('frostTouch','서리 손길',['냉기'],'mage',undefined,r=>({id:'서리 손길',when:'hit',chance:.2+.1*(r-1),run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'chill',c.t,c.ev);}})),
  trait('current','전류',['전기'],'mage',()=>({})),
  trait('flow','마력 순환',['화염'],'mage',undefined,r=>({id:'마력 순환',when:'kill',run:(_p,c)=>{c.src.ultReady-=r;}})),
  trait('combust','연소',['화염'],'mage',undefined,()=>({id:'연소',when:'kill',test:(_p,c)=>(c.target?.status.burn?.until??0)>c.t,run:(p,c)=>{if(c.target)for(const f of nearby(p,c.target,1))applyStatus(p,c.src,f,'burn',c.t,c.ev);}})),
  trait('blessing','깊은 신앙',['치유'],'cleric',(_u,r)=>({heal:.3*r})),
  trait('quickPrayer','신속한 기도',['치유'],'cleric',()=>({})),
  trait('warding','수호의 빛',['방패'],'cleric',(_u,r)=>({ward:5*r})),
  trait('retribution','응징',['방패','협공'],'cleric',()=>({})),
  trait('purify','정화',['치유'],'cleric',()=>({})),
  trait('martyr','순교',['치유'],'cleric',undefined,r=>({id:'순교',when:'crisis',run:(p,c)=>{for(const a of nearby(p,c.src,2))heal(p,c.src,a,15+10*(r-1),c.t,c.ev);}})),
  trait('shadow','그림자 걸음',['은신'],'rogue',(_u,r)=>({stealth:r})),
  trait('poisonBlade','독 묻힌 칼',['독'],'rogue',undefined,r=>({id:'독 묻힌 칼',when:'hit',run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'poison',c.t,c.ev,r>=2?2:1);}})),
  trait('vital','급소 공략',['치명'],'rogue',(_u,r)=>({crit:.1*r})),
  trait('ambush','기습',['은신','치명'],'rogue',()=>({})),
  trait('smokescreen','연막',['은신'],'rogue',undefined,()=>({id:'연막',when:'crisis',run:(p,c)=>{c.src.hiddenUntil=c.t+1;for(const f of nearby(p,c.src,1,'foe'))f.blindUntil=c.t+1;}})),
  trait('bladeDance','칼춤',['은신','근접'],'rogue',undefined,teleportStrike),
];

function teleportStrike(r:number): ReturnType<NonNullable<TraitDef['trigger']>> { return {id:'칼춤',when:'kill',run:(p,c)=>{const f=nearby(p,c.src,2,'foe')[0];if(f&&entOf(p,f.id)!.alive){c.src.empower=Math.max(c.src.empower,1+.25*r);c.src.blinkNext=true;}}}; }
