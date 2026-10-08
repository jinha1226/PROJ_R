import { it, expect } from 'vitest';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { emit, sourcesOf } from '../../src/sim/party/triggers';
import { KITS } from '../../src/sim/party/classKit';
import { aiUltimate, useUltimate } from '../../src/sim/party/ultimate';
import { BASE_CLASSES, type ClassId } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';
it.each(BASE_CLASSES)('%s has two innates with their specific combat effects', (cls) => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, ally = p.units[1]!, ev: GEvent[] = [];
  u.cls = cls; u.weapon = { warrior: 'swordShield', archer: 'longbow', mage: 'staff', cleric: 'mace', rogue: 'daggers', necromancer: 'staff' }[cls] as typeof u.weapon;
  // the rogue also carries its clones' blows, the cleric's hand of salvation answers its own crisis too; the necromancer has one innate and its golem's fall
  expect(sourcesOf(p,u)).toHaveLength(cls === 'rogue' || cls === 'cleric' ? 3 : 2);
  entOf(p,f.id)!.pos={x:4,y:4};entOf(p,p.units[4]!.id)!.pos={x:3,y:5};
  entOf(p,f.id)!.hp=entOf(p,f.id)!.maxHp=1000;
  entOf(p,ally.id)!.hp=1;u.nth=3;u.still=2;p.s.rng.chance=c=>c>.2;
  if(cls==='warrior') {
    u.struckTimes=[0,0.2];emit(p,'struck',{t:0.2,src:u,target:f,ev});expect(entOf(p,f.id)!.hp).toBeLessThan(1000);
    const hp=entOf(p,f.id)!.hp;emit(p,'block',{t:0,src:u,target:f,ev});expect(entOf(p,f.id)!.hp).toBeLessThan(hp);
  } else if(cls==='archer') {
    emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.nextCrit).toBe(true);
    emit(p,'still',{t:0,src:u,target:f,ev});expect(u.steady).toBe(2);
  } else if(cls==='mage') {
    f.status.freeze={until:2};emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.attackMult).toBe(2);expect(f.status.freeze).toBeUndefined();
    // the element cycle lays the next element on a blow
    const before=Object.keys(f.status).length;emit(p,'hit',{t:0,src:u,target:f,ev});expect(Object.keys(f.status).length).toBeGreaterThan(before);
  } else if(cls==='cleric') {
    emit(p,'allyCrisis',{t:0,src:u,target:ally,ev});expect(entOf(p,ally.id)!.hp).toBe(23);
    emit(p,'combatStart',{t:0,src:u,ev});expect(p.units.filter(x=>x.side==='hero').map(x=>x.shield)).toEqual([10,10,10]);
  } else if(cls==='necromancer') {
    // a kill: the body bursts on the foes beside it, and can still be raised
    const near=p.units[4]!; entOf(p,near.id)!.hp=entOf(p,near.id)!.maxHp=1000; entOf(p,f.id)!.alive=false;
    emit(p,'kill',{t:0,src:u,target:f,ev});
    expect(f.burst).toBe(true); expect(f.raised).toBeFalsy(); expect(entOf(p,near.id)!.hp).toBeLessThan(1000);
  } else {
    f.order={kind:'attack',target:ally.id};emit(p,'beforeHit',{t:0,src:u,target:f,ev});expect(u.attackMult).toBe(1.6);
    emit(p,'kill',{t:0,src:u,target:f,ev});expect(u.hiddenUntil).toBe(1);
  }
});
it('off-proficiency disables innates', () => {
  const p = partyRoom(), u = p.units[0]!;
  u.weapon = 'staff'; expect(sourcesOf(p, u)).toEqual([]); u.weapon = 'swordShield'; expect(sourcesOf(p, u)).toHaveLength(2);
});
it.each(['warrior','archer','mage','cleric','rogue','necromancer'] as ClassId[])('%s ultimate executes once and waits its cooldown', (cls) => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!; u.cls = cls;
  entOf(p, f.id)!.pos = { x: 4, y: 4 };
  // the mage's teleport and the warrior's earth slam need a free cell; the rest aim at the foe
  const free = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]].map(([dx, dy]) => ({ x: 4 + dx!, y: 4 + dy! })).find((c) => !p.units.some((x) => entOf(p, x.id)?.alive && entOf(p, x.id)!.pos.x === c.x && entOf(p, x.id)!.pos.y === c.y))!;
  // the golem needs a body: the foe lies dead where it stood
  if (cls === 'necromancer') { entOf(p, f.id)!.alive = false; f.raised = false; }
  expect(useUltimate(p, u.id, cls === 'mage' || cls === 'warrior' ? free : { x: 4, y: 4 }).length).toBeGreaterThan(0);
  expect(u.ultReady).toBe(KITS[cls].ultCd); expect(useUltimate(p, u.id)).toEqual([]);
});
it('a hurt AI cleric raises the sanctuary where it stands, and blows inside do nothing', () => {
  const p=partyRoom(),u=p.units[2]!;u.cls='cleric';u.weapon='symbol';
  const e=entOf(p,u.id)!;e.hp=10;
  expect(aiUltimate(p,u)).toEqual({ slot: 0, cell: e.pos });for(const v of p.units)v.nextAt=100;u.nextAt=0;
  tick(p,.1);expect((u.immuneUntil??0)>p.time).toBe(true);expect(u.ultReady).toBe(45);
  u.shield=0;damage(p,p.time,'trap',u,10,[]);expect(e.hp).toBe(10);
});
