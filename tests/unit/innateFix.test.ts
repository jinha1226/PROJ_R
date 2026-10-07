import { applyStatus } from '../../src/sim/party/status';
import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { KITS } from '../../src/sim/party/classKit';
import { action, emit, type TriggerDef } from '../../src/sim/party/triggers';
import { CATALOG } from '../../src/sim/delve/catalog';
import type { ClassId } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';
const setup = (cls: ClassId, weapon: 'staff' | 'daggers' | 'crossbow' | 'swordShield' | 'mace' = 'staff') => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!; u.cls = cls; u.weapon = weapon;
  entOf(p,f.id)!.pos={x:8,y:4}; entOf(p,f.id)!.hp=entOf(p,f.id)!.maxHp=1000;
  u.triggers=[]; p.s.rng.int = a => a; p.s.rng.chance = c => c > .5;
  return { p, u, f };
};
it.each(['archer','mage','rogue'] as const)('%s damage innate changes the next blow through its trigger', cls => {
  const {p,u,f}=setup(cls,cls==='rogue'?'daggers':cls==='archer'?'crossbow':'staff');
  if(cls==='mage')f.status.freeze={until:5};
  if(cls==='rogue')f.order={kind:'attack',target:p.units[1]!.id};
  const id={archer:'기습 사격',mage:'파쇄',rogue:'배후 급소'}[cls];
  const def=KITS[cls].innate.find(d=>d.id===id)!, before=JSON.stringify([u,f]);
  def.run(p,{t:0,src:u,target:f,depth:0,ev:[]}); expect(JSON.stringify([u,f])).not.toBe(before);
});
/** a critical blow opens a bleeding wound (the old common trait, kept here for these chain checks) */
const wound:TriggerDef={id:'상처 벌리기',when:'crit',run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'bleed',c.t,c.ev);}};
it('iron plate trigger activates its actual reduction', () => {
  const {p,u}=setup('warrior','swordShield');const before=JSON.stringify(u);
  CATALOG.ironPlate!.triggers[0]!.run(p,{t:0,src:u,depth:0,ev:[]});expect(JSON.stringify(u)).not.toBe(before);
});
it('no-op effects consume neither popup nor budget and crit bleed still fires in a poison chain', () => {
  const {p,u,f}=setup('rogue','daggers');u.traits={};u.triggers=[wound];
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  u.triggers=[...Array.from({length:6},(_,i)=>({id:`noop${i}`,when:'hit' as const,run:()=>{}})),wound];
  const ev:GEvent[]=[];action(p,()=>{emit(p,'hit',{t:0,src:u,target:f,amount:8,ev});emit(p,'crit',{t:0,src:u,target:f,amount:8,ev});});
  expect(f.status.bleed).toBeDefined(); expect(ev.some(e=>e.text?.startsWith('noop'))).toBe(false);
});
it('damage innates deliver exact bonuses without duplicate passive multipliers', () => {
  const hit=(cls:ClassId,active:boolean)=>{
    const weapon=cls==='archer'?'crossbow':cls==='mage'?'staff':'daggers';const{p,u,f}=setup(cls,weapon);
    if(cls==='archer')entOf(p,f.id)!.hp=active?1000:900;
    if(cls==='mage'&&active)f.status.freeze={until:5};
    if(cls==='rogue')f.order={kind:'attack',target:active?p.units[1]!.id:u.id};
    const hp=entOf(p,f.id)!.hp;strike(p,u,f,0,[]);return hp-entOf(p,f.id)!.hp;
  };
  expect([hit('archer',false),hit('archer',true)]).toEqual([13,20]);
  expect([hit('mage',false),hit('mage',true)]).toEqual([5,10]);
  expect([hit('rogue',false),hit('rogue',true)]).toEqual([4,6]);
});
it('iron plate reduces incoming damage by twenty percent after two stationary attacks', async () => {
  const {gearTaken}=await import('../../src/sim/delve/catalogEffects');const{p,u}=setup('warrior','swordShield');
  u.gear={weapon:null,armor:{id:'iron',def:'ironPlate',power:0},accessory:null};u.weapon='fists';
  u.still=1;expect(gearTaken(u)).toBe(1);u.still=2;emit(p,'still',{t:0,src:u,ev:[]});expect(gearTaken(u)).toBe(.8);
  u.still=0;expect(gearTaken(u)).toBe(1);
});
it('full-health leech is a no-op even before lowHp bookkeeping is initialized', () => {
  const {p,u,f}=setup('rogue','daggers');u.traits={};u.triggers=[wound];delete u.lowHp;
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  u.triggers=[...[0,1].map(i=>({id:`actual${i}`,when:'hit' as const,run:()=>{u.progress++;}})),wound];
  const ev:GEvent[]=[];action(p,()=>{emit(p,'hit',{t:0,src:u,target:f,amount:8,ev});emit(p,'crit',{t:0,src:u,target:f,ev});});
  expect(f.status.bleed).toBeDefined();expect(ev.some(e=>e.text==='흡혈')).toBe(false);
});
it('a real rogue critical attack preserves poison, leech and critical bleeding in one chain', () => {
  const {p,u,f}=setup('rogue','daggers');u.traits={envenom:1};u.triggers=[wound];u.nextCrit=true;
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  f.order={kind:'attack',target:p.units[1]!.id};entOf(p,u.id)!.hp=40;
  const ev:GEvent[]=[];strike(p,u,f,0,ev);
  expect(f.status.poison?.stacks).toBe(1);expect(f.status.bleed).toBeDefined();expect(entOf(p,u.id)!.hp).toBeGreaterThan(40);
  expect(ev.filter(e=>['배후 급소','독니','흡혈','상처 벌리기'].includes(e.text??''))).toHaveLength(4);
});
it('guard oath still redirects damage when its wearer holds an off-proficiency weapon', () => {
  const {p,u}=setup('warrior','staff'),ally=p.units[1]!;u.shield=0;ally.shield=0;
  u.gear={weapon:{id:'s',def:'staff',power:0},armor:null,accessory:{id:'g',def:'guardOath',power:0}};
  entOf(p,ally.id)!.pos={x:3,y:3};const hp=entOf(p,ally.id)!.hp,guardHp=entOf(p,u.id)!.hp;
  damage(p,0,'trap',ally,40,[]);expect(hp-entOf(p,ally.id)!.hp).toBe(28);expect(guardHp-entOf(p,u.id)!.hp).toBe(12);
});
