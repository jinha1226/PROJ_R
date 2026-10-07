import { addShield } from './shield';
import { G } from '../delve/gear';
import { DIRS, dist, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { KITS, type UltId } from './classKit';
import { soulsOf } from './body';
import { summon } from './kitEffects';
import { applyStatus } from './status';
import { action, emit } from './triggers';
import { T } from './traitMods';
export const ULT_NAMES: Record<UltId,string> = { warcry:'전장의 함성',arrowRain:'화살비',meteor:'운석',sanctum:'신성 결계',shadowDance:'그림자 난무',bloodFrenzy:'피의 광란',bastion:'방벽',pierceShot:'관통탄',bleedRain:'피의 화살비',elementStorm:'원소 폭풍',deadHost:'망자의 군세',judgement:'심판의 빛',longSanctum:'빛의 결계',deathDance:'죽음의 난무',toxicFog:'독안개' };
export interface UltSlot { slot: number; ult: UltId; ready: number; cd: number }
/** the ultimates that need a cell picked by the player */
export const AIMED: UltId[] = ['arrowRain', 'bleedRain', 'meteor', 'elementStorm', 'pierceShot', 'judgement', 'toxicFog'];
/** One ultimate per soul in the body, each with its own cooldown (a unit given a class directly has its class's one). */
export function ultSlots(u: Unit): UltSlot[] {
  if (!soulsOf(u).length) { const k = KITS[u.cls ?? 'shell']; return k.ultimate ? [{ slot: 0, ult: k.ultimate, ready: u.ultReady, cd: k.ultCd }] : []; }
  return soulsOf(u).flatMap((s, slot) => { const k = KITS[s.cls]; return k.ultimate ? [{ slot, ult: k.ultimate, ready: s.ultReady, cd: k.ultCd }] : []; });
}
const slotOf = (u: Unit, slot: number): UltSlot | undefined => ultSlots(u).find((s) => s.slot === slot);
export function queueUltimate(p: Party,id: string,cell?: Cell,slot = 0): void {
  const u=unitOf(p,id), s=u && slotOf(u,slot); if(!u || !s || !alive(p,u) || p.time < s.ready) return;
  u.ultQueued = !(u.ultQueued && u.ultSlot === slot); u.ultSlot = slot; u.ultCell=cell;
}
export function useUltimate(p: Party,id: string,cell?: Cell,slot = 0): GEvent[] {
  return action(p,()=>castUltimate(p,id,cell,slot));
}
function castUltimate(p: Party,id: string,cell: Cell | undefined,slot: number): GEvent[] {
  const u=unitOf(p,id), s=u && slotOf(u,slot); if(!u || !s || u.side!=='hero' || !alive(p,u) || (p.time < s.ready && !u.traits?.bloodPact)) return [];
  const ult=s.ult;
  const t=p.time, ev:GEvent[]=[], me=posOf(p,u), target=targetOf(p,u,t), at=cell??(target && posOf(p,target));
  const foes=p.units.filter(x=>x.side==='foe' && alive(p,x) && !x.asleep);
  const near=(center:Cell,r:number)=>foes.filter(f=>dist(posOf(p,f),center)<=r);
  const allies=p.units.filter(x=>x.side==='hero' && alive(p,x));
  const aimed=AIMED.includes(ult);
  if(aimed && (!at || !walkable(tileAt(p.s.map,at)) || dist(me,at)>10 || !near(at,ult==='meteor'||ult==='elementStorm'?2:1).length)) return [];
  if(['shadowDance','deathDance','bloodFrenzy'].includes(ult) && !near(me,4).length) return [];
  if(u.traits?.bloodPact){const e=entOf(p,id)!,cost=Math.round(e.maxHp*.3);if(e.hp<=cost)return [];e.hp-=cost;}
  switch(ult) {
    case 'warcry': case 'bastion':
      for(const f of near(me,4)) {f.tauntBy=id; f.tauntUntil=t+5; emit(p,'taunt',{t,src:u,target:f,ev});}
      for(const a of allies) addShield(a, ult==='bastion'?30:15);
      break;
    case 'bloodFrenzy': u.leechUntil=t+5; break;
    case 'sanctum': case 'longSanctum': for(const a of allies) if(dist(posOf(p,a),me)<=3) a.immuneUntil=t+(ult==='longSanctum'?5:3); break;
    case 'arrowRain': case 'bleedRain': {
      const targets=near(at!,1);
      for(let k=0;k<5;k++) {const f=targets[k%targets.length]!; if(alive(p,f)) {strike(p,u,f,t,ev,1,false); if(ult==='bleedRain') applyStatus(p,u,f,'bleed',t,ev);}}
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
    case 'deadHost':
      for (const f of p.units.filter(x => x.side === 'foe' && !alive(p,x) && !x.raised && dist(posOf(p,x),me) <= 6))
        if (summon(p,u,posOf(p,f),t,ev,3)) f.raised = true;
      break;
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
  const next=u.traits?.bloodPact?t:t+s.cd*T.cd(u)*G.cd(u);
  if (soulsOf(u).length) soulsOf(u)[slot]!.ultReady=next; else u.ultReady=next;
  u.ultQueued=false;u.nextAt=Math.max(u.nextAt,t+0.6);
  emit(p,'ultimate',{t,src:u,ev});return ev;
}
/** The first ready soul ultimate a companion would use now, and where (null when none). */
export function aiUltimate(p: Party,u: Unit): { slot: number; cell?: Cell } | null {
  if(!alive(p,u)) return null;
  for(const s of ultSlots(u)) {
    if(p.time<s.ready) continue;
    const cell=aiUse(p,u,s.ult);
    if(cell!==null) return { slot:s.slot, cell };
  }
  return null;
}
function aiUse(p: Party,u: Unit,ult: UltId): Cell | undefined | null {
  const me=posOf(p,u), foes=p.units.filter(x=>x.side==='foe'&&alive(p,x)&&!x.asleep&&dist(posOf(p,x),me)<=10);
  if(!foes.length) return null;
  if(['sanctum','longSanctum','warcry','bastion'].includes(ult)) return p.units.some(x=>x.side==='hero'&&alive(p,x)&&entOf(p,x.id)!.hp<entOf(p,x.id)!.maxHp/2)||foes.length>=3 ? undefined:null;
  if(['bloodFrenzy','shadowDance','deathDance'].includes(ult)) return foes.some(x=>dist(posOf(p,x),me)<=4)?undefined:null;
  if(ult==='deadHost') return p.units.some(x=>x.side==='foe'&&!alive(p,x)&&!x.raised&&dist(posOf(p,x),me)<=6)?undefined:null;
  const best=foes.sort((a,b)=>foes.filter(x=>dist(posOf(p,x),posOf(p,b))<=2).length-foes.filter(x=>dist(posOf(p,x),posOf(p,a))<=2).length)[0]!;
  return foes.filter(x=>dist(posOf(p,x),posOf(p,best))<=2).length>=3||best.foe==='warlord'?posOf(p,best):null;
}
