import { DIRS, dist, tileAt, walkable, type GEvent } from '../grid/types';
import { alive, damage, entOf, occupied, posOf, type Party, type Unit } from './partyCore';
import { heal, nearby } from './kitEffects';
import { rank } from './traitDefs';
import { mods } from './traitMods';
export function traitMult(p:Party,u:Unit,target:Unit,t:number):number {
  let m=1;
  if(u.attackMoved)m*=1+.15*rank(u,'pursuit');
  if(u.retreatShot)m*=1+(mods(u).retreat??0);
  u.retreatShot=false;
  if(t<(u.furyUntil??0))m*=1+(u.furyPower??0)*(u.furyStacks??0);
  if(t<(u.damageBuffUntil??0))m*=u.damageBuff??1;
  if(t<u.hiddenUntil) {
    if(rank(u,'shadowOath'))m*=3;else if(rank(u,'ambush'))m*=2;
  }
  if(rank(u,'divinePunish')&&(target.status.stun?.until??0)>t)m*=2;
  if(rank(u,'loneWolf')&&nearby(p,u,2).filter(x=>x!==u&&!x.summoner).length===0)m*=1.6;
  return m;
}
export function takenMult(p:Party,u:Unit,t:number):number {
  let m=1+(mods(u).taken??0);
  if(rank(u,'shadowOath')&&t>=u.hiddenUntil)m*=1.25;
  if(rank(u,'boneArmor')&&p.units.some(x=>x.summoner===u.id&&alive(p,x)))m*=.8;
  return m;
}
export function shieldBroken(p:Party,u:Unit,t:number,ev:GEvent[]):void {
  if(rank(u,'lifeSpring'))heal(p,u,u,10*rank(u,'lifeSpring'),t,ev);
}
export function allyStruck(p:Party,u:Unit,attacker:Unit|undefined,t:number,ev:GEvent[]):void {
  if(!attacker)return;
  for(const a of nearby(p,u,2)) if(a!==u&&rank(a,'retribution')&&!rank(a,'loneWolf'))damage(p,t,a.id,attacker,4*rank(a,'retribution'),ev,true);
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
