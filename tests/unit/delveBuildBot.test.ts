import { expect,it } from 'vitest';
import { supplies } from '../bot/delveBotPolicy';
import { summarize,type Run } from '../bot/delveBotRun';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant,living } from '../../src/sim/roam/roam';
import { gainXp,LEVEL_XP } from '../../src/sim/party/partyLevel';
it('bot equips deeper proficient gear and sacrifices exact duplicates while keeping off-family weapons out of its hands',()=>{
 const p=newDelve(2),u=living(p)[0]!;implant(p,u,'warrior',[]);
 p.pack=[{id:'wrong',def:'emberStaff',power:0},{id:'better',def:'flameSword',power:0},{id:'duplicate',def:'flameSword',power:0}];
 supplies(p);expect(u.gear!.weapon?.def).toBe('flameSword');expect(u.gear!.weapon?.power).toBe(.25);expect(p.pack.some(i=>i.id==='duplicate')).toBe(false);expect(p.pack.some(i=>i.id==='wrong')).toBe(true);
});
it('bot picks the first offered trait until its pending choices are spent',()=>{
 const p=newDelve(2),u=living(p)[0]!;implant(p,u,'rogue',[]);gainXp(p,u,LEVEL_XP[1]!,[]);
 const first=u.offer![0]!;expect(u.picks).toBeGreaterThan(0);supplies(p);expect(u.traits?.[first]).toBeGreaterThan(0);expect(u.picks).toBe(0);
});
it('summary distinguishes arriving at floor three from surviving it',()=>{
 const run=(floor:number):Run=>({seed:floor,comp:'warrior/mage/rogue',floor,general:false,lost:2,end:'wipe',seconds:100,lastPolicy:'combat',idleSeconds:0,floors:[]});
 const s=summarize([run(3),run(4)]);expect(s.total.reach3).toBe(100);expect(s.total.survive3).toBe(50);expect(s.comps.find(c=>c.comp==='warrior/mage/rogue')!.survive3).toBe(50);
});
