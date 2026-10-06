import { it, expect } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { emit } from '../../src/sim/party/triggers';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { rollOffer } from '../../src/sim/party/traitPool';
import { BASE_CLASSES } from '../../src/sim/party/partyDefs';
it('has exactly 24 common, 30 base, 20 advanced and six keystones', () => {
  const defs=Object.values(TRAITS);
  expect(defs.filter(d=>d.pool==='common')).toHaveLength(24);
  expect(defs.filter(d=>BASE_CLASSES.includes(d.pool as typeof BASE_CLASSES[number]))).toHaveLength(30);
  expect(defs.filter(d=>d.pool!=='common'&&d.pool!=='keystone'&&!BASE_CLASSES.includes(d.pool as typeof BASE_CLASSES[number]))).toHaveLength(20);
  expect(defs.filter(d=>d.pool==='keystone')).toHaveLength(6);
  expect(defs.every(d=>d.tags.length>0 && (!!d.passive||!!d.trigger))).toBe(true);
});
it('offers two class cards and one common, excluding maxed traits', () => {
  const p=partyRoom(),u=p.units[0]!;u.traits={shieldPro:3};
  for(let k=0;k<100;k++) {const cards=rollOffer(p,u);expect(cards.filter(id=>TRAITS[id]!.pool==='warrior')).toHaveLength(2);expect(cards.filter(id=>TRAITS[id]!.pool==='common')).toHaveLength(1);expect(cards).not.toContain('shieldPro');}
});
it('doubles matching tag weights over 2000 fixed-seed offers', () => {
  const p=partyRoom(undefined,812),u=p.units[0]!;u.traits={finish:1};u.weapon='fists';let tagged=0,plain=0;
  for(let k=0;k<2000;k++) for(const id of rollOffer(p,u)) if(TRAITS[id]!.pool==='common') {if(TRAITS[id]!.tags.includes('치명')) tagged++;else plain++;}
  const a=Object.values(TRAITS).filter(d=>d.pool==='common'&&d.tags.includes('치명')).length;
  expect(tagged/a/(plain/(24-a))).toBeGreaterThanOrEqual(2);
});
it('offers one keystone fourth at levels 10 and 14 until one is held', () => {
  const p=partyRoom(),u=p.units[0]!;
  for(const level of [9,10,11,13,14,15]) {u.level=level;expect(rollOffer(p,u)).toHaveLength(level===10||level===14?4:3);}
  u.traits={bloodPact:1};u.level=14;expect(rollOffer(p,u)).toHaveLength(3);
});
it('finish, morale, grit, bond and combo work end to end', () => {
  const p=partyRoom(),u=p.units[0]!,ally=p.units[1]!,f=p.units[3]!,e=entOf(p,u.id)!;
  entOf(p,ally.id)!.pos={x:3,y:3};entOf(p,ally.id)!.hp=10;
  u.traits={finish:1,morale:1};damage(p,0,u.id,f,999,[]);
  expect(u.empower).toBe(1.5);expect(entOf(p,ally.id)!.hp).toBe(14);
  u.traits={grit:1};damage(p,0,'trap',u,999,[]);expect(e.hp).toBe(1);damage(p,1,'trap',u,999,[]);expect(e.alive).toBe(false);
  const q=partyRoom(undefined,13),v=q.units[0]!,g=q.units[3]!;v.traits={combo:1,bond:1};v.nth=3;
  entOf(q,g.id)!.pos={x:4,y:4};entOf(q,g.id)!.hp=entOf(q,g.id)!.maxHp=1000;
  const ev: Parameters<typeof emit>[2]['ev']=[];emit(q,'nth',{t:0,src:v,target:g,ev});expect(ev.some(e=>e.type==='bump')).toBe(true);
  const first=entOf(q,g.id)!.hp; q.s.rng.chance=c=>c>0.2; strike(q,v,g,0,[]);expect(entOf(q,g.id)!.hp).toBeLessThan(first);
});
