import { applyStatus } from '../../src/sim/party/status';
import { SHIELD_CAP } from '../../src/sim/party/shield';
import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { damage, entOf, stats, strike } from '../../src/sim/party/partyCore';
import { KITS } from '../../src/sim/party/classKit';
import { action, emit, CHAIN_CAP, type TriggerDef } from '../../src/sim/party/triggers';
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
/** a critical blow opens a bleeding wound (the old common trait, kept here for these chain checks) */
const wound:TriggerDef={id:'상처 벌리기',when:'crit',run:(p,c)=>{if(c.target)applyStatus(p,c.src,c.target,'bleed',c.t,c.ev);}};
it('sniper doubles damage at five tiles but not four', () => {
  const hit = (distance: number) => {const {p,u,f}=setup('sniper','crossbow');entOf(p,f.id)!.pos={x:3+distance,y:4};entOf(p,f.id)!.hp=900;strike(p,u,f,0,[]);return 900-entOf(p,f.id)!.hp;};
  expect(hit(5)).toBe(hit(4)*2);
});
it('berserker crisis doubles attack speed and healing ends it', () => {
  const {p,u}=setup('berserker','swordShield');const before=stats(u).atk;u.shield=0;
  damage(p,0,'trap',u,60,[]); expect(stats(u).atk).toBe(before/2);
  heal(p,u,u,100,0,[]);expect(stats(u).atk).toBe(before);
  u.lowHp=true;KITS.berserker.innate[2]!.run(p,{t:0,src:u,ev:[],depth:0});expect(u.lowHp).toBe(false);
});
it('guardian innate intercepts damage; healer overflow and elementalist fireball change state', () => {
  const {p,u,f}=setup('guardian','swordShield');const before=entOf(p,u.id)!.hp;u.shield=0;
  KITS.guardian.innate[2]!.run(p,{t:0,src:u,target:f,amount:10,ev:[],depth:0});expect(entOf(p,u.id)!.hp).toBeLessThan(before);
  u.cls='healer';u.weapon='mace';u.shield=0;heal(p,u,u,999,0,[]);expect(u.shield).toBe(SHIELD_CAP);
  u.shield=0;KITS.healer.innate[2]!.run(p,{t:0,src:u,target:u,amount:4,ev:[],depth:0});expect(u.shield).toBe(4);
  u.cls='elementalist';u.weapon='staff';fireball(p,u,f,0,[]);expect(f.status.chill??f.status.shock).toBeDefined();
  f.status={};KITS.elementalist.innate[2]!.run(p,{t:0,src:u,target:f,ev:[],depth:0});expect(f.status.chill??f.status.shock).toBeDefined();
});
it('iron plate trigger activates its actual reduction', () => {
  const {p,u}=setup('warrior','swordShield');const before=JSON.stringify(u);
  CATALOG.ironPlate!.triggers[0]!.run(p,{t:0,src:u,depth:0,ev:[]});expect(JSON.stringify(u)).not.toBe(before);
});
it('no-op effects consume neither popup nor budget and crit bleed still fires in a poison chain', () => {
  const {p,u,f}=setup('assassin','daggers');u.traits={};u.triggers=[wound];
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
    if(cls==='rogue'||cls==='assassin')f.order={kind:'attack',target:cls==='rogue'&&active?p.units[1]!.id:u.id};
    if(cls==='assassin')entOf(p,f.id)!.hp=active?300:900;
    const hp=entOf(p,f.id)!.hp;strike(p,u,f,0,[]);return hp-entOf(p,f.id)!.hp;
  };
  expect([hit('archer',false),hit('archer',true)]).toEqual([13,20]);
  expect([hit('mage',false),hit('mage',true)]).toEqual([5,10]);
  expect([hit('rogue',false),hit('rogue',true)]).toEqual([4,6]);
  expect([hit('assassin',false),hit('assassin',true)]).toEqual([4,8]);
});
it('iron plate reduces incoming damage by twenty percent after two stationary attacks', async () => {
  const {gearTaken}=await import('../../src/sim/delve/catalogEffects');const{p,u}=setup('warrior','swordShield');
  u.gear={weapon:null,armor:{id:'iron',def:'ironPlate',power:0},accessory:null};u.weapon='fists';
  u.still=1;expect(gearTaken(u)).toBe(1);u.still=2;emit(p,'still',{t:0,src:u,ev:[]});expect(gearTaken(u)).toBe(.8);
  u.still=0;expect(gearTaken(u)).toBe(1);
});
it('guardian redirects thirty percent only when its effect executes', () => {
  const run=(full:boolean)=>{
    const p=partyRoom(),guard=p.units[0]!,ally=p.units[1]!,actor=p.units[2]!;
    guard.cls='guardian';guard.weapon='swordShield';guard.shield=0;ally.shield=0;actor.weapon='fists';
    entOf(p,ally.id)!.pos={x:3,y:3};entOf(p,actor.id)!.pos={x:1,y:1};
    actor.triggers=Array.from({length:CHAIN_CAP},(_,i)=>({id:`budget${i}`,when:'hit' as const,run:()=>{actor.progress++;}}));
    const hp=entOf(p,ally.id)!.hp,guardHp=entOf(p,guard.id)!.hp;
    action(p,()=>{if(full)emit(p,'hit',{t:0,src:actor,ev:[]});damage(p,0,'trap',ally,40,[]);});
    return [hp-entOf(p,ally.id)!.hp,guardHp-entOf(p,guard.id)!.hp];
  };
  expect(run(false)).toEqual([28,9]);expect(run(true)).toEqual([40,0]);
});
it('full-health leech is a no-op even before lowHp bookkeeping is initialized', () => {
  const {p,u,f}=setup('assassin','daggers');u.traits={};u.triggers=[wound];delete u.lowHp;
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  u.triggers=[...[0,1].map(i=>({id:`actual${i}`,when:'hit' as const,run:()=>{u.progress++;}})),wound];
  const ev:GEvent[]=[];action(p,()=>{emit(p,'hit',{t:0,src:u,target:f,amount:8,ev});emit(p,'crit',{t:0,src:u,target:f,ev});});
  expect(f.status.bleed).toBeDefined();expect(ev.some(e=>e.text==='흡혈')).toBe(false);
});
it('a real assassin critical attack preserves poison, leech and critical bleeding in one chain', () => {
  const {p,u,f}=setup('assassin','daggers');u.traits={envenom:1};u.triggers=[wound];u.nextCrit=true;
  u.gear={weapon:{id:'v',def:'viper',power:0},armor:null,accessory:{id:'r',def:'vampireRing',power:0}};
  f.order={kind:'attack',target:p.units[1]!.id};entOf(p,u.id)!.hp=40;
  const ev:GEvent[]=[];strike(p,u,f,0,ev);
  expect(f.status.poison?.stacks).toBe(1);expect(f.status.bleed).toBeDefined();expect(entOf(p,u.id)!.hp).toBeGreaterThan(40);
  expect(ev.filter(e=>['배후 급소','독니','흡혈','상처 벌리기'].includes(e.text??''))).toHaveLength(4);
});
it('guard oath still redirects damage when a guardian wears an off-proficiency weapon', () => {
  const {p,u}=setup('guardian','staff'),ally=p.units[1]!;u.shield=0;ally.shield=0;
  u.gear={weapon:{id:'s',def:'staff',power:0},armor:null,accessory:{id:'g',def:'guardOath',power:0}};
  entOf(p,ally.id)!.pos={x:3,y:3};const hp=entOf(p,ally.id)!.hp,guardHp=entOf(p,u.id)!.hp;
  damage(p,0,'trap',ally,40,[]);expect(hp-entOf(p,ally.id)!.hp).toBe(28);expect(guardHp-entOf(p,u.id)!.hp).toBe(12);
});
