import { it, expect } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { emit } from '../../src/sim/party/triggers';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { rollOffer } from '../../src/sim/party/traitPool';
import { BASE_CLASSES } from '../../src/sim/party/partyDefs';
it('has exactly 12 common, the class cards, 12 empty-body, 10 duo and six oath cards', () => {
  const defs=Object.values(TRAITS);
  expect(defs).toHaveLength(96);
  expect(defs.filter(d=>d.pool==='shell')).toHaveLength(12);
  expect(defs.filter(d=>d.pool==='common')).toHaveLength(12);
  // the necromancer's cards arrive with plan C3b task 3
  // the classes moved to branches (C3b) have twelve; the rest still eight
  for(const cls of BASE_CLASSES.filter((c)=>c!=='necromancer'&&c!=='mage')) expect(defs.filter(d=>d.pool===cls),cls).toHaveLength(8);
  expect(defs.filter(d=>d.pool==='mage')).toHaveLength(12); expect(defs.filter(d=>d.pool==='necromancer')).toHaveLength(12);
  expect(defs.filter(d=>d.pool==='duo')).toHaveLength(10);
  expect(defs.filter(d=>d.pool==='keystone')).toHaveLength(6);
  expect(defs.every(d=>d.tags.length>0 && (!!d.passive||!!d.trigger||!!d.triggers||!!d.kind))).toBe(true);
});
it('offers two class cards and one common or duo, excluding maxed cards', () => {
  const p=partyRoom(),u=p.units[0]!;u.traits={thorns:2};u.level=4;
  for(let k=0;k<100;k++) {const cards=rollOffer(p,u);expect(cards.filter(id=>TRAITS[id]!.pool==='warrior')).toHaveLength(2);expect(cards.filter(id=>TRAITS[id]!.pool==='common'||TRAITS[id]!.pool==='duo')).toHaveLength(1);expect(cards).not.toContain('thorns');}
});
it('doubles matching tag weights over 2000 fixed-seed offers', () => {
  const p=partyRoom(undefined,812),u=p.units[0]!;u.traits={finish:1};u.weapon='fists';let tagged=0,plain=0;
  for(let k=0;k<2000;k++) for(const id of rollOffer(p,u)) if(TRAITS[id]!.pool==='common') {if(TRAITS[id]!.tags.includes('치명')) tagged++;else plain++;}
  const a=Object.values(TRAITS).filter(d=>d.pool==='common'&&d.tags.includes('치명')).length;
  expect(tagged/a/(plain/(Object.values(TRAITS).filter(d=>d.pool==='common').length-a))).toBeGreaterThanOrEqual(2);
});
it('offers one keystone fourth at levels 10 and 14 until one is held', () => {
  const p=partyRoom(),u=p.units[0]!;
  for(const level of [9,10,11,13,14,15]) {u.level=level;expect(rollOffer(p,u)).toHaveLength(level===10||level===14?4:3);}
  u.traits={bloodPact:1};u.level=14;expect(rollOffer(p,u)).toHaveLength(3);
});
it('finish, morale and combo work end to end', () => {
  const p=partyRoom(),u=p.units[0]!,ally=p.units[1]!,f=p.units[3]!,e=entOf(p,u.id)!;
  entOf(p,ally.id)!.pos={x:3,y:3};entOf(p,ally.id)!.hp=10;
  u.traits={finish:1,morale:1};damage(p,0,u.id,f,999,[]);
  expect(u.empower).toBe(2);expect(entOf(p,ally.id)!.hp).toBe(18);void e;
  const q=partyRoom(undefined,13),v=q.units[0]!,g=q.units[3]!;v.traits={combo:1};v.nth=3;
  entOf(q,g.id)!.pos={x:4,y:4};entOf(q,g.id)!.hp=entOf(q,g.id)!.maxHp=1000;
  const ev: Parameters<typeof emit>[2]['ev']=[];emit(q,'nth',{t:0,src:v,target:g,ev});expect(ev.some(e=>e.type==='bump')).toBe(true);

});
it.each([[9,11],[13,15]])('keystone due at a milestone survives a jump from %i to %i', async (from, to) => {
  const {gainXp, LEVEL_XP, pickTrait} = await import('../../src/sim/party/partyLevel');
  const p=partyRoom(),u=p.units[0]!;u.level=from;u.xp=LEVEL_XP[from-1]!;
  u.picks=1;u.offer=['finish'];
  gainXp(p,u,LEVEL_XP[to-1]!-u.xp,[]);expect(u.level).toBe(to);
  pickTrait(p,u.id,'finish'); expect(u.offer).toHaveLength(4);expect(TRAITS[u.offer![3]!]!.pool).toBe('keystone');
  const stone=u.offer![3]!;pickTrait(p,u.id,stone);expect(u.offer?.length??3).toBe(3);
});

it('bond adds fifteen percent per nearby living ally', () => {
  const hit=(bond:number,near:boolean)=>{
    const p=partyRoom(),u=p.units[0]!,f=p.units[3]!,ally=p.units[1]!;
    p.units=[u,f,ally];u.traits={bond};entOf(p,ally.id)!.pos={x:near?3:10,y:3};
    entOf(p,f.id)!.hp=entOf(p,f.id)!.maxHp=1000;
    p.s.rng.int=()=>20;p.s.rng.chance=c=>c>.2;strike(p,u,f,0,[]);return 1000-entOf(p,f.id)!.hp;
  };
  expect(hit(1,true)).toBe(23);expect(hit(0,true)).toBe(20);expect(hit(1,false)).toBe(20);
});
