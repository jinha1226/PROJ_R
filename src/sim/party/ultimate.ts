import { G } from '../delve/gear';
import { DIRS, dist, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { kitOf, type UltId } from './classKit';
import { summon } from './kitEffects';
import { applyStatus } from './status';
import { action, emit } from './triggers';
import { T } from './traitMods';
export const ULT_NAMES: Record<UltId,string> = { warcry:'전장의 함성',arrowRain:'화살비',meteor:'운석',sanctum:'신성 결계',shadowDance:'그림자 난무',bloodFrenzy:'피의 광란',bastion:'방벽',pierceShot:'관통탄',bleedRain:'피의 화살비',elementStorm:'원소 폭풍',deadHost:'망자의 군세',judgement:'심판의 빛',longSanctum:'빛의 결계',deathDance:'죽음의 난무',toxicFog:'독안개' };
export function queueUltimate(p: Party,id: string,cell?: Cell): void {
  const u=unitOf(p,id); if(!u || !alive(p,u) || !kitOf(u).ultimate || p.time < u.ultReady) return;
  u.ultQueued = !u.ultQueued; u.ultCell=cell;
}
export function useUltimate(p: Party,id: string,cell?: Cell): GEvent[] {
  return action(p,()=>castUltimate(p,id,cell));
}
function castUltimate(p: Party,id: string,cell?: Cell): GEvent[] {
  const u=unitOf(p,id); if(!u || u.side!=='hero' || !alive(p,u) || (p.time < u.ultReady && !u.traits?.bloodPact)) return [];
  const kit=kitOf(u), ult=kit.ultimate; if(!ult) return [];
  const t=p.time, ev:GEvent[]=[], me=posOf(p,u), target=targetOf(p,u,t), at=cell??(target && posOf(p,target));
  const foes=p.units.filter(x=>x.side==='foe' && alive(p,x) && !x.asleep);
  const near=(center:Cell,r:number)=>foes.filter(f=>dist(posOf(p,f),center)<=r);
  const allies=p.units.filter(x=>x.side==='hero' && alive(p,x));
  const aimed=['arrowRain','bleedRain','meteor','elementStorm','pierceShot','judgement','toxicFog'].includes(ult);
  if(aimed && (!at || !walkable(tileAt(p.s.map,at)) || dist(me,at)>10 || !near(at,ult==='meteor'||ult==='elementStorm'?2:1).length)) return [];
  if(['shadowDance','deathDance','bloodFrenzy'].includes(ult) && !near(me,4).length) return [];
  if(u.traits?.bloodPact){const e=entOf(p,id)!,cost=Math.round(e.maxHp*.3);if(e.hp<=cost)return [];e.hp-=cost;}
  switch(ult) {
    case 'warcry': case 'bastion':
      for(const f of near(me,4)) {f.tauntBy=id; f.tauntUntil=t+5; emit(p,'taunt',{t,src:u,target:f,ev});}
      for(const a of allies) a.shield += ult==='bastion'?30:15;
      break;
    case 'bloodFrenzy': u.leechUntil=t+5; break;
    case 'sanctum': case 'longSanctum': for(const a of allies) if(dist(posOf(p,a),me)<=3) a.immuneUntil=t+(ult==='longSanctum'?5:3); break;
    case 'arrowRain': case 'bleedRain': {
      const targets=near(at!,1+(u.traits?.arrowShower?1:0));
      for(let k=0;k<(u.traits?.arrowShower===3?8:5);k++) {const f=targets[k%targets.length]!; if(alive(p,f)) {strike(p,u,f,t,ev,1,false); if(ult==='bleedRain') applyStatus(p,u,f,'bleed',t,ev);}}
      break;
    }
    case 'meteor': case 'elementStorm':
      for(const f of near(at!,2)) {damage(p,t,id,f,p.s.rng.int(24,32)*T.amplify(u),ev); applyStatus(p,u,f,'burn',t,ev); if(ult==='elementStorm') {applyStatus(p,u,f,'chill',t,ev);applyStatus(p,u,f,'shock',t,ev);}}
      break;
    case 'judgement': for(const f of near(at!,2)) {damage(p,t,id,f,22,ev);applyStatus(p,u,f,'stun',t,ev);} break;
    case 'toxicFog': for(const f of near(at!,2)) applyStatus(p,u,f,'poison',t,ev,5); break;
    case 'pierceShot': {
      const dx=at!.x-me.x,dy=at!.y-me.y, divisor=Math.max(Math.abs(dx),Math.abs(dy));
      for(let k=1;k<Math.max(p.s.map.w,p.s.map.h);k++) {
        const c={x:me.x+Math.round(dx*k/divisor),y:me.y+Math.round(dy*k/divisor)};
        if(!walkable(tileAt(p.s.map,c))) break;
        for(const f of foes) if(same(posOf(p,f),c)) damage(p,t,id,f,p.s.rng.int(18,24),ev);
      } break;
    }
    case 'deadHost': for(const f of p.units.filter(x=>x.side==='foe'&&!alive(p,x))) summon(p,u,posOf(p,f),t,ev,Infinity); break;
    case 'shadowDance': case 'deathDance':
      for(const f of near(me,4).slice(0,ult==='deathDance'?6:4)) {
        if(!alive(p,u)) break;
        const from={...posOf(p,u)}, tp=posOf(p,f);
        const spot=DIRS.map(d=>({x:tp.x+d.x,y:tp.y+d.y})).find(c=>walkable(tileAt(p.s.map,c))&&!occupied(p,c,id));
        if(!spot) continue;
        const move:GEvent={t,type:'teleport',src:id,from,to:spot}; ev.push(move);entOf(p,id)!.pos=spot;p.onMovement?.([move],ev);
        if(alive(p,u)) strike(p,u,f,t,ev,2,false);
      } break;
  }
  ev.push({t,type:'buff',src:id,dst:id,text:ULT_NAMES[ult]});
  u.ultReady=u.traits?.bloodPact?t:t+kit.ultCd*T.cd(u)*G.cd(u);u.ultQueued=false;u.nextAt=Math.max(u.nextAt,t+0.6);
  emit(p,'ultimate',{t,src:u,ev});return ev;
}
export function aiUltimate(p: Party,u: Unit): Cell | undefined | null {
  if(!alive(p,u)||p.time<u.ultReady||!kitOf(u).ultimate) return null;
  const ult=kitOf(u).ultimate!, me=posOf(p,u), foes=p.units.filter(x=>x.side==='foe'&&alive(p,x)&&!x.asleep&&dist(posOf(p,x),me)<=10);
  if(!foes.length) return null;
  if(['sanctum','longSanctum','warcry','bastion'].includes(ult)) return p.units.some(x=>x.side==='hero'&&alive(p,x)&&entOf(p,x.id)!.hp<entOf(p,x.id)!.maxHp/2)||foes.length>=3 ? undefined:null;
  if(['bloodFrenzy','shadowDance','deathDance'].includes(ult)) return foes.some(x=>dist(posOf(p,x),me)<=4)?undefined:null;
  if(ult==='deadHost') return p.units.some(x=>x.side==='foe'&&!alive(p,x))?undefined:null;
  const best=foes.sort((a,b)=>foes.filter(x=>dist(posOf(p,x),posOf(p,b))<=2).length-foes.filter(x=>dist(posOf(p,x),posOf(p,a))<=2).length)[0]!;
  return foes.filter(x=>dist(posOf(p,x),posOf(p,best))<=2).length>=3||best.foe==='warlord'?posOf(p,best):null;
}
