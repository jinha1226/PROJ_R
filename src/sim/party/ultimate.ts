import { G } from '../delve/gear';
import { DIRS, dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, occupied, posOf, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { KITS, type UltId } from './classKit';
import { soulsOf } from './body';
import { dropWell, GRAVITY_REACH } from './gravity';
import { teleport } from './cardsMage';
import { raiseGolem } from './cardsNecro';
import { corpsesNear, isCorpse } from './corpses';
import { shadowClone } from './cardsRogue';
import { earthSlam } from './cardsWarrior';
import { sanctuary } from './cardsCleric';
import { applyStatus } from './status';
import { action, emit } from './triggers';
import { T } from './traitMods';
export const ULT_NAMES: Record<UltId,string> = { earthSlam:'대지 강타',arrowRain:'화살비',teleport:'순간이동',sanctum:'신성 결계',shadowClone:'그림자 분신',golem:'골렘',gravity:'중력탄' };
/** how far from its caster each ultimate may be aimed (a farther cell: the caster walks closer first) */
export const ULT_REACH: Record<UltId, number> = { earthSlam: 5, arrowRain: 10, teleport: 8, sanctum: 6, shadowClone: 10, golem: 10, gravity: 10 };
export interface UltSlot { slot: number; ult: UltId; ready: number; cd: number }
/** the ultimates that need a cell picked by the player (every soul's and the empty body's) */
export const AIMED: UltId[] = ['earthSlam', 'arrowRain', 'teleport', 'sanctum', 'shadowClone', 'golem', 'gravity'];
/** One ultimate per soul in the body, each with its own cooldown (a unit given a class directly has its class's one). */
export function ultSlots(u: Unit): UltSlot[] {
  // summoned bodies (skeletons share the empty body's class) cast nothing
  if (u.summoner) return [];
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
  // arrow rain and the gravity grenade need a foe near the cell; the rest check their own cell
  if((ult==='arrowRain'||ult==='gravity') && (!at || !walkable(tileAt(p.s.map,at)) || dist(me,at)>10 || !near(at,ult==='gravity'?GRAVITY_REACH:1).length)) return [];
  const pact=u.traits?.bloodPact?Math.round(entOf(p,id)!.maxHp*.3):0; if(pact && entOf(p,id)!.hp<=pact) return [];
  switch(ult) {
    case 'arrowRain': {
      const targets=near(at!,1);
      for(let k=0;k<5;k++) {const f=targets[k%targets.length]!; if(alive(p,f)) {strike(p,u,f,t,ev,1,false); if(alive(p,f)) applyStatus(p,u,f,'mark',t,ev);}}
      break;
    }
    case 'gravity': dropWell(p,id,at!,t); break;
    case 'sanctum': if(!cell || !sanctuary(p,u,cell,t)) return []; break;
    case 'earthSlam': if(!cell || !earthSlam(p,u,cell,t,ev)) return []; break;
    case 'shadowClone': if(!cell || !shadowClone(p,u,cell,t,ev)) return []; break;
    case 'golem': if(!cell || !raiseGolem(p,u,cell,t,ev)) return []; break;
    case 'teleport': if(!cell || !teleport(p,u,cell,t,ev)) return []; emit(p,'teleport',{t,src:u,ev}); break;
  }
  // the blood pact is paid only for an ultimate that went off
  if(pact) entOf(p,id)!.hp-=pact;
  ev.push({t,type:'buff',src:id,dst:id,text:ULT_NAMES[ult]});
  const next=u.traits?.bloodPact?t:t+s.cd*T.cd(u)*G.cd(u)*(p.boost?.ult??1);
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
  // the sanctuary goes where the cleric stands, when it is hurt or crowded
  if(ult==='sanctum') return entOf(p,u.id)!.hp<entOf(p,u.id)!.maxHp/2||foes.filter(x=>dist(posOf(p,x),me)<=3).length>=3 ? {...me}:null;
  // teleport: away from two foes at its side, to the free cell within reach farthest from every foe
  if(ult==='teleport') {
    if(foes.filter(x=>dist(posOf(p,x),me)<=1).length<2) return null;
    let best: Cell | null = null, far = 1;
    for(let dy=-8;dy<=8;dy++) for(let dx=-8;dx<=8;dx++) {
      const c={x:me.x+dx,y:me.y+dy};
      if(!walkable(tileAt(p.s.map,c))||occupied(p,c,u.id)) continue;
      const d=Math.min(...foes.map(x=>dist(posOf(p,x),c)));
      if(d>far){far=d;best=c;}
    }
    return best;
  }
  // golem: on the body with the most bodies within three (two at least)
  if(ult==='golem') {
    const spots=p.units.filter(x=>isCorpse(p,x)&&dist(posOf(p,x),me)<=10).map(x=>({at:posOf(p,x),n:corpsesNear(p,posOf(p,x),3).length})).sort((a,b)=>b.n-a.n);
    return spots[0]&&spots[0].n>=2?{...spots[0].at}:null;
  }
  // earth slam: beside the foe within five with the most foes within two of it (two at least)
  if(ult==='earthSlam') {
    const near=(f:Unit)=>foes.filter(x=>dist(posOf(p,x),posOf(p,f))<=2).length;
    const best=foes.filter(f=>dist(posOf(p,f),me)<=6).sort((a,b)=>near(b)-near(a))[0];
    if(!best||near(best)<2) return null;
    const bp=posOf(p,best);
    return DIRS.map(d=>({x:bp.x+d.x,y:bp.y+d.y})).find(c=>walkable(tileAt(p.s.map,c))&&!occupied(p,c,u.id)&&dist(c,me)<=5)??null;
  }
  // the clones stand beside the rogue: they copy its blows on the foes round it and draw their blows off it
  if(ult==='shadowClone') return foes.filter(x=>dist(posOf(p,x),me)<=2).length>=2?me:null;
  // arrow rain and the gravity grenade: on the foe with the most foes round it (three, or a warlord)
  const best=foes.sort((a,b)=>foes.filter(x=>dist(posOf(p,x),posOf(p,b))<=2).length-foes.filter(x=>dist(posOf(p,x),posOf(p,a))<=2).length)[0]!;
  return foes.filter(x=>dist(posOf(p,x),posOf(p,best))<=2).length>=3||best.foe==='warlord'?posOf(p,best):null;
}
