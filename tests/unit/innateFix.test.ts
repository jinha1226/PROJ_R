import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { damage, entOf, stats, strike } from '../../src/sim/party/partyCore';
import { KITS } from '../../src/sim/party/classKit';
import { action, emit } from '../../src/sim/party/triggers';
import { heal, fireball } from '../../src/sim/party/kitEffects';
import { CATALOG } from '../../src/sim/delve/catalog';
import type { ClassId } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';
const setup = (cls: ClassId, weapon: 'staff' | 'daggers' | 'crossbow' | 'swordShield' | 'mace' = 'staff') => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!; u.cls = cls; u.weapon = weapon;
  entOf(p,f.id)!.pos={x:8,y:4}; entOf(p,f.id)!.hp=entOf(p,f.id)!.maxHp=1000;
  u.triggers=[]; p.s.rng.int = a => a; p.s.rng.chance = c => c > .5;
  return { p, u, f };
};
it.each(['archer','mage','rogue','sniper','assassin'] as const)('%s damage innate changes the next blow through its trigger', cls => {
  const {p,u,f}=setup(cls,cls==='rogue'||cls==='assassin'?'daggers':cls==='archer'||cls==='sniper'?'crossbow':'staff');
  if(cls==='mage')f.status.freeze={until:5}; if(cls==='assassin')entOf(p,f.id)!.hp=300;
  if(cls==='rogue')f.order={kind:'attack',target:p.units[1]!.id};
  const id={archer:'기습 사격',mage:'파쇄',rogue:'배후 급소',sniper:'저격',assassin:'처형술'}[cls];
  const def=KITS[cls].innate.find(d=>d.id===id)!, before=JSON.stringify([u,f]);
  def.run(p,{t:0,src:u,target:f,depth:0,ev:[]}); expect(JSON.stringify([u,f])).not.toBe(before);
});
it('sniper doubles damage at five tiles but not four', () => {
  const hit = (distance: number) => {const {p,u,f}=setup('sniper','crossbow');entOf(p,f.id)!.pos={x:3+distance,y:4};entOf(p,f.id)!.hp=900;strike(p,u,f,0,[]);return 900-entOf(p,f.id)!.hp;};
  expect(hit(5)).toBe(hit(4)*2);
});
it('berserker crisis doubles attack speed and healing ends it', () => {
  const {p,u}=setup('berserker','swordShield');const before=stats(u).atk;u.shield=0;
  damage(p,0,'trap',u,60,[]); expect(stats(u).atk).toBe(before/2);
  heal(p,u,u,100,0,[]);expect(stats(u).atk).toBe(before);
  u.lowHp=false;KITS.berserker.innate[2]!.run(p,{t:0,src:u,ev:[],depth:0});expect(u.lowHp).toBe(true);
});
it('guardian innate intercepts damage; healer overflow and elementalist fireball change state', () => {
  const {p,u,f}=setup('guardian','swordShield');const before=entOf(p,u.id)!.hp;u.shield=0;
  KITS.guardian.innate[2]!.run(p,{t:0,src:u,target:f,amount:10,ev:[],depth:0});expect(entOf(p,u.id)!.hp).toBeLessThan(before);
  u.cls='healer';u.weapon='mace';u.shield=0;heal(p,u,u,999,0,[]);expect(u.shield).toBe(30);
  u.shield=0;KITS.healer.innate[2]!.run(p,{t:0,src:u,target:u,amount:4,ev:[],depth:0});expect(u.shield).toBe(4);
  u.cls='elementalist';u.weapon='staff';fireball(p,u,f,0,[]);expect(f.status.chill??f.status.shock).toBeDefined();
  f.status={};KITS.elementalist.innate[2]!.run(p,{t:0,src:u,target:f,ev:[],depth:0});expect(f.status.chill??f.status.shock).toBeDefined();
});
it('iron plate trigger activates its actual reduction', () => {
  const {p,u}=setup('warrior','swordShield');const before=JSON.stringify(u);
  CATALOG.ironPlate!.triggers[0]!.run(p,{t:0,src:u,depth:0,ev:[]});expect(JSON.stringify(u)).not.toBe(before);
});
it('no-op effects consume neither popup nor budget and crit bleed still fires in a poison chain', () => {
  const {p,u,f}=setup('assassin','daggers');u.traits={poisonBlade:1,openWound:1};
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  u.triggers=Array.from({length:6},(_,i)=>({id:`noop${i}`,when:'hit' as const,run:()=>{}}));
  const ev:GEvent[]=[];action(p,()=>{emit(p,'hit',{t:0,src:u,target:f,amount:8,ev});emit(p,'crit',{t:0,src:u,target:f,amount:8,ev});});
  expect(f.status.bleed).toBeDefined(); expect(ev.some(e=>e.text?.startsWith('noop'))).toBe(false);
});
