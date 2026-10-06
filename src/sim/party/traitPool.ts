import type { Party,Unit } from './partyCore';
import { TRAITS,rank } from './traitDefs';
import { tagsOf,LINE } from './classKit';
export function rollOffer(p:Party,u:Unit):string[] {
  const tags=tagsOf(u),available=Object.values(TRAITS).filter(d=>rank(u,d.id)<d.ranks);
  const draw=(pool:typeof available,n:number):string[]=>{
    const result:string[]=[];
    while(pool.length && result.length<n) {
      const weights=pool.map(d=>d.tags.some(t=>(tags[t]??0)>0)?2:1),total=weights.reduce((a,b)=>a+b,0);
      let r=p.s.rng.next()*total,index=0;while(index<pool.length-1 && r>=weights[index]!)r-=weights[index++]!;
      result.push(pool.splice(index,1)[0]!.id);
    }return result;
  };
  const line=u.cls==='veteran'?u.soul:u.cls;
  const own=available.filter(d=>d.pool===line);
  // Exhausted two-card advanced pools fall back to that class's base pool.
  if(own.length<2)own.push(...available.filter(d=>d.pool===(LINE[u.cls!]??u.soul)&&!own.includes(d)));
  const cards=[...draw(own,2),...draw(available.filter(d=>d.pool==='common'),1)];
  if([10,14].includes(u.level??1)&&!Object.keys(u.traits??{}).some(id=>TRAITS[id]?.pool==='keystone'))cards.push(...draw(available.filter(d=>d.pool==='keystone'),1));
  return cards;
}
