import { expect, it } from 'vitest';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { entOf } from '../../src/sim/party/partyCore';
import { summon } from '../../src/sim/party/kitEffects';
import type { GEvent } from '../../src/sim/grid/types';
it('expired summons are removed from both simulation arrays during the tick', () => {
  const p = partyRoom(), u = p.units[0]!, ev: GEvent[] = [];
  summon(p, u, { x: 5, y: 4 }, 0, ev); const id = ev[0]!.dst!;
  for (const v of p.units) v.nextAt = 100;
  tick(p, 11); expect(p.units.some(v => v.id === id)).toBe(false); expect(p.s.foes.some(e => e.id === id)).toBe(false);
});
it('the legion card and the necklace cannot raise the same corpse twice', async () => {
  const {emit}=await import('../../src/sim/party/triggers');const p=partyRoom(),u=p.units[0]!,f=p.units[3]!;
  u.cls='necromancer';u.weapon='staff';u.gear={weapon:{id:'staff',def:'staff',power:0},armor:null,accessory:{id:'neck',def:'deadNecklace',power:0}};
  entOf(p,f.id)!.pos={x:4,y:4};entOf(p,f.id)!.alive=false;
  // the necklace raises on every fifth kill: this is the fifth, and the legion card raises on every kill
  u.traits={raiseSkeleton:1};u.tally={'망자의 부름':4};
  const ev:GEvent[]=[];emit(p,'kill',{t:0,src:u,target:f,ev});expect(ev.filter(e=>e.type==='summon')).toHaveLength(1);expect(f.raised).toBe(true);
});
