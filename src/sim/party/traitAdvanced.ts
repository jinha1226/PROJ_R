import { addShield } from './shield';
import { alive, entOf, damage } from './partyCore';
import { heal, nearby, summon } from './kitEffects';
import { applyStatus } from './status';
import { trait, type TraitDef } from './traitTypes';
export const ADVANCED_TRAITS: TraitDef[] = [
  trait('bloodHunger','피의 굶주림',['근접','치유'],'berserker',undefined,r=>({id:'피의 굶주림',when:'kill',run:(p,c)=>heal(p,c.src,c.src,entOf(p,c.src.id)!.maxHp*.1*r,c.t,c.ev)})),
  trait('redFury','붉은 분노',['근접','출혈'],'berserker',undefined,r=>({id:'붉은 분노',when:'crisis',run:(_p,c)=>{c.src.damageBuff=1+.2*r;c.src.damageBuffUntil=c.t+5;}})),
  trait('unyieldingShield','불굴의 방패',['방패','협공'],'guardian',undefined,r=>({id:'불굴의 방패',when:'block',run:(p,c)=>{for(const a of nearby(p,c.src,2))addShield(a, 5*r);}})),
  trait('shieldThorns','방벽의 가시',['방패','근접'],'guardian',undefined,r=>({id:'방벽의 가시',when:'block',run:(p,c)=>{if(c.target)damage(p,c.t,c.src.id,c.target,4*r,c.ev);}})),
  trait('breath','숨 고르기',['원거리','치명'],'sniper',undefined,r=>({id:'숨 고르기',when:'still',nth:3,run:(_p,c)=>{if(c.src.still>=3)c.src.empower=3+.5*(r-1);}})),
  trait('longSight','먼 눈',['원거리'],'sniper',(_u,r)=>({range:r})),
  trait('trap','덫',['출혈','독'],'hunter',undefined,()=>({id:'덫',when:'statusApplied',test:(_p,c)=>c.status==='freeze',run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'bleed',c.t,c.ev);}})),
  trait('tracking','맹독 추적',['독','원거리'],'hunter',undefined,r=>({id:'맹독 추적',when:'hit',chance:.2*r,run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'poison',c.t,c.ev);}})),
  trait('elementResonance','원소 공명',['화염','냉기','전기'],'elementalist',undefined,r=>({id:'원소 공명',when:'statusApplied',cd:1,test:(_p,c)=>['burn','chill','shock'].filter(id=>(c.target?.status[id as 'burn']?.until??0)>c.t).length>=2,run:(p,c)=>{if(c.target)for(const f of nearby(p,c.target,1))damage(p,c.t,c.src.id,f,6*r,c.ev);}})),
  trait('elementVeil','원소 장막',['냉기','전기'],'elementalist',undefined,r=>({id:'원소 장막',when:'statusApplied',cd:2,run:(_p,c)=>{addShield(c.src, 3*r);}})),
  trait('boneArmor','뼈의 갑옷',['소환','생존'],'necromancer',()=>({})),
  trait('boneSeed','뼈의 씨앗',['소환'],'necromancer',undefined,r=>({id:'뼈의 씨앗',when:'ultimate',run:(p,c)=>summon(p,c.src,entOf(p,c.src.id)!.pos,c.t,c.ev,2+r)})),
  trait('divinePunish','신벌',['근접','방패'],'inquisitor',()=>({})),
  splash('judgementEcho','심판의 메아리',['근접','협공'],'inquisitor'),
  trait('lifeSpring','생명의 샘',['치유','방패'],'healer',()=>({})),
  trait('sharedLight','나눔의 빛',['치유','협공'],'healer',undefined,r=>({id:'나눔의 빛',when:'ultimate',run:(p,c)=>{for(const a of nearby(p,c.src,3))heal(p,c.src,a,8*r,c.t,c.ev);}})),
  trait('execute','처형',['치명','은신'],'assassin',undefined,r=>({id:'처형',when:'hit',chance:.2+.1*(r-1),test:(p,c)=>!!c.target&&entOf(p,c.target.id)!.hp<entOf(p,c.target.id)!.maxHp*.25,run:(p,c)=>{if(c.target)damage(p,c.t,c.src.id,c.target,entOf(p,c.target.id)!.hp,c.ev,true);}})),
  trait('shadowHarvest','그림자 수확',['은신','치명'],'assassin',undefined,r=>({id:'그림자 수확',when:'kill',run:(_p,c)=>{c.src.ultReady-=2*r;}})),
  trait('poisonEssence','독의 정수',['독'],'toxicologist',(_u,r)=>({poisonCap:3*r})),
  trait('poisonSpread','독의 파문',['독'],'toxicologist',undefined,r=>({id:'독의 파문',when:'kill',run:(p,c)=>{if(c.target)for(const f of nearby(p,c.target,1))applyStatus(p,c.src,f,'poison',c.t,c.ev,r);}})),
];

function splash(id:string,name:string,tags:TraitDef['tags'],pool:TraitDef['pool']): TraitDef { return trait(id,name,tags,pool,undefined,r=>({id:name,when:'kill',run:(p,c)=>{if(c.target)for(const f of nearby(p,c.target,1))if(alive(p,f))damage(p,c.t,c.src.id,f,4*r,c.ev);}})); }
