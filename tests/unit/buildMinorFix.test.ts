import { expect, it } from 'vitest';
import { partyRoom, nextWave } from '../../src/sim/party/partySim';
import { newDelve } from '../../src/sim/delve/delveSim';
import { living } from '../../src/sim/roam/roam';
import { useItem } from '../../src/sim/delve/gear';
import { entOf } from '../../src/sim/party/partyCore';
import type { GEvent } from '../../src/sim/grid/types';
it('room and wave starts deliver innate popups to the real event list', () => {
  const ev:GEvent[]=[];const p=partyRoom([{cls:'cleric',weapon:'mace'}],11,ev);
  expect(ev.some(e=>e.text==='축복')).toBe(true);ev.length=0;
  for(const u of p.units)if(u.side==='foe')entOf(p,u.id)!.alive=false;
  expect(nextWave(p,ev)).toBe(true);expect(ev.some(e=>e.text==='축복')).toBe(true);
});
it('manual full-health potion is refused without consuming inventory or a turn', () => {
  const p=newDelve(2),u=living(p)[0]!;p.pack=[{id:'p',consumable:'potion'}];p.manual=u.id;p.waiting=true;
  const next=u.nextAt;expect(useItem(p,u.id,'p')).toEqual([]);expect(p.pack).toHaveLength(1);expect(p.waiting).toBe(true);expect(u.nextAt).toBe(next);
});
