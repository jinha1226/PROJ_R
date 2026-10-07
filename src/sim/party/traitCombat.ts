import { DIRS, dist, tileAt, walkable, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, type Party, type Unit } from './partyCore';
import { heal, nearby } from './kitEffects';
import { rank } from './traitDefs';
import { mods } from './traitMods';
import { tagsOf } from './classKit';
import { applyStatus } from './status';
export function traitMult(p:Party,u:Unit,target:Unit,t:number):number {
  let m=1;
  if(u.retreatShot)m*=1+(mods(u).retreat??0);
  u.retreatShot=false;
  if(t<(u.furyUntil??0))m*=1+(u.furyPower??0)*(u.furyStacks??0);
  if(t<(u.damageBuffUntil??0))m*=u.damageBuff??1;
  if(t<u.hiddenUntil) {
    if(rank(u,'shadowOath'))m*=3;else if(rank(u,'ambushArt'))m*=1+.5*(tagsOf(u).은신??0);
  }
  if(rank(u,'loneWolf')&&nearby(p,u,2).filter(x=>x!==u&&!x.summoner).length===0)m*=1.6;
  return m;
}
export function takenMult(p:Party,u:Unit,t:number):number {
  let m=1+(mods(u).taken??0);
  if(rank(u,'shadowOath')&&t>=u.hiddenUntil)m*=1.25;
  return m;
}
/** A clone's shield gave out: a cleric with shield burst hurts the foes beside it by what broke. */
export function shieldBroken(p:Party,u:Unit,t:number,ev:GEvent[],amount=0):void {
  for(const c of p.units) if(c.side==='hero'&&alive(p,c)&&rank(c,'shieldBurst')) for(const f of nearby(p,u,1,'foe')) { damage(p,t,c.id,f,amount,ev,true); if(rank(c,'shieldBurst')>=2) applyStatus(p,c,f,'stun',t,ev); }
}
/** A clone fell: a martyr's party heals a third and hits harder for two turns. */
export function allyFell(p:Party,u:Unit,t:number,ev:GEvent[]):void {
  for(const c of p.units) if(c!==u&&c.side==='hero'&&alive(p,c)&&rank(c,'martyr')) for(const a of p.units) if(a.side==='hero'&&!a.summoner&&alive(p,a)) { heal(p,c,a,entOf(p,a.id)!.maxHp*.3,t,ev); a.damageBuff=1.3; a.damageBuffUntil=t+2; }
}
/** A martyr's upgrade: once a floor a clone's killing blow leaves it one point of health. */
export function martyrHolds(p:Party,u:Unit):boolean {
  const floor=(p as {floor?:number}).floor??0, c=p.units.find(x=>x!==u&&x.side==='hero'&&alive(p,x)&&rank(x,'martyr')>=2);
  if(!c||c.martyrFloor===floor)return false;
  c.martyrFloor=floor;return true;
}
export function blink(p:Party,u:Unit,target:Unit,t:number,ev:GEvent[]):void {
  if(!u.blinkNext)return;u.blinkNext=false;
  const tp=posOf(p,target),spot=DIRS.map(d=>({x:tp.x+d.x,y:tp.y+d.y})).find(c=>walkable(tileAt(p.s.map,c))&&!occupied(p,c,u.id));
  if(!spot||dist(posOf(p,u),tp)>2)return;
  const move:GEvent={t,type:'teleport',src:u.id,from:{...posOf(p,u)},to:spot};ev.push(move);entOf(p,u.id)!.pos=spot;u.steady=0;u.still=0;p.onMovement?.([move],ev);
}
export function tickTraitRegen(p:Party,from:number,to:number,ev:GEvent[]):void {
  for(const u of p.units)if(alive(p,u)&&rank(u,'shadowOath')) {
    const ticks=Math.max(0,Math.floor(Math.min(to,u.hiddenUntil))-Math.floor(from));
    if(ticks)heal(p,u,u,entOf(p,u.id)!.maxHp*.05*ticks,to,ev);
  }
}
