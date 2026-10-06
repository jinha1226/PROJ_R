import { TRAITS } from '../../src/sim/party/traitDefs';
import { it, expect } from 'vitest';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { emit, sourcesOf } from '../../src/sim/party/triggers';
import { KITS, promotionOptions, promote } from '../../src/sim/party/classKit';
import { aiUltimate, useUltimate } from '../../src/sim/party/ultimate';
import { BASE_CLASSES, type ClassId } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';
it.each(BASE_CLASSES)('%s has two innates with their specific combat effects', (cls) => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, ally = p.units[1]!, ev: GEvent[] = [];
  u.cls = cls; u.weapon = { warrior: 'swordShield', archer: 'longbow', mage: 'staff', cleric: 'mace', rogue: 'daggers' }[cls] as typeof u.weapon;
  expect(sourcesOf(p,u)).toHaveLength(2);
  entOf(p,f.id)!.pos={x:4,y:4};entOf(p,p.units[4]!.id)!.pos={x:3,y:5};
  entOf(p,f.id)!.hp=entOf(p,f.id)!.maxHp=1000;
  entOf(p,ally.id)!.hp=1;u.nth=3;u.still=2;p.s.rng.chance=c=>c>.2;
  if(cls==='warrior') {
    emit(p,'hit',{t:0,src:u,target:f,ev});expect(entOf(p,f.id)!.hp).toBeLessThan(1000);
    const hp=entOf(p,f.id)!.hp;emit(p,'block',{t:0,src:u,target:f,ev});expect(entOf(p,f.id)!.hp).toBeLessThan(hp);
  } else if(cls==='archer') {
    emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.nextCrit).toBe(true);
    emit(p,'still',{t:0,src:u,target:f,ev});expect(u.steady).toBe(2);
  } else if(cls==='mage') {
    f.status.freeze={until:2};emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.attackMult).toBe(2);expect(f.status.freeze).toBeUndefined();
    emit(p,'nth',{t:0,src:u,target:f,ev});expect(entOf(p,f.id)!.hp).toBeLessThan(1000);
  } else if(cls==='cleric') {
    emit(p,'allyCrisis',{t:0,src:u,target:ally,ev});expect(entOf(p,ally.id)!.hp).toBe(23);
    emit(p,'combatStart',{t:0,src:u,ev});expect(p.units.filter(x=>x.side==='hero').map(x=>x.shield)).toEqual([10,10,10]);
  } else {
    f.order={kind:'attack',target:ally.id};emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.attackMult).toBe(1.6);
    emit(p,'kill',{t:0,src:u,target:f,ev});expect(u.hiddenUntil).toBe(1);
  }
});
it('whirl waits six seconds and off-proficiency disables innates', () => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, ev: GEvent[] = [];
  entOf(p, f.id)!.pos = { x: 4, y: 4 }; entOf(p, p.units[4]!.id)!.pos = { x: 3, y: 5 };
  emit(p, 'hit', { t: 0, src: u, target: f, ev }); emit(p, 'hit', { t: 5, src: u, target: f, ev });
  expect(ev.filter(e => e.text === '포위 베기')).toHaveLength(1);
  u.weapon = 'staff'; expect(sourcesOf(p, u)).toEqual([]); u.weapon = 'swordShield'; expect(sourcesOf(p, u)).toHaveLength(2);
});
it.each(['warrior','archer','mage','cleric','rogue','berserker','guardian','sniper','hunter','elementalist','necromancer','inquisitor','healer','assassin','toxicologist'] as ClassId[])('%s ultimate executes once and waits its cooldown', (cls) => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!; u.cls = cls;
  entOf(p, f.id)!.pos = { x: 4, y: 4 };
  expect(useUltimate(p, u.id, { x: 4, y: 4 }).length).toBeGreaterThan(0);
  expect(u.ultReady).toBe(KITS[cls].ultCd); expect(useUltimate(p, u.id)).toEqual([]);
});
it('recounts shield gear and cards before promoting', () => {
  const p = partyRoom(), u = p.units[0]!; u.level = 8; u.traits = Object.fromEntries(Object.values(TRAITS).filter((d) => d.tags.includes('방패')).slice(0, 3).map((d) => [d.id, 1]));
  expect(promotionOptions(p, u).find(o=>o.to==='guardian')?.met).toBe(true);
  u.weapon = 'greataxe'; expect(promotionOptions(p, u).find(o=>o.to==='guardian')?.met).toBe(false);
  expect(promote(p, u.id, 'guardian')).toEqual([]); u.weapon = 'swordShield'; expect(promote(p, u.id, 'guardian').length).toBe(1);
});
it('offers veteran at ten only when no other rule is met', () => {
  const p = partyRoom(), u = p.units[0]!; u.weapon = 'greataxe'; u.level = 9;
  expect(promotionOptions(p, u).find(o=>o.to==='veteran')?.met).toBe(false);
  u.level = 10; expect(promotionOptions(p, u).find(o=>o.to==='veteran')?.met).toBe(true);
});
it('AI casts sanctuary on its moment and prevents damage until expiry', () => {
  const p=partyRoom(),u=p.units[2]!;u.cls='cleric';u.weapon='symbol';
  const ally=p.units[0]!, e=entOf(p,ally.id)!;e.hp=10;
  expect(aiUltimate(p,u)).not.toBeNull();for(const v of p.units)v.nextAt=100;u.nextAt=0;
  tick(p,.1);expect(ally.immuneUntil).toBe(3);expect(u.ultReady).toBe(45);
  damage(p,1,'trap',ally,10,[]);expect(e.hp).toBe(10);
  u.trig['구원의 손']=100;ally.shield=0;damage(p,3,'trap',ally,4,[]);expect(e.hp).toBe(7);
});
