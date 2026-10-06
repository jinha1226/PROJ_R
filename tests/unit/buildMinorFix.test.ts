import { expect, it } from 'vitest';
import { partyRoom, nextWave } from '../../src/sim/party/partySim';
import { newDelve } from '../../src/sim/delve/delveSim';
import { living, implant } from '../../src/sim/roam/roam';
import { useItem, G } from '../../src/sim/delve/gear';
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
it('berserker gets twenty percent damage with proficient two-hand weapons only', () => {
  const p=newDelve(2),u=living(p)[0]!;implant(p,u,'warrior',[]);u.cls='berserker';
  u.gear!.weapon={id:'great',def:'greataxe',power:0};u.weapon='greataxe';expect(G.dmg(u)).toBe(1.2);
  u.gear!.weapon={id:'shield',def:'swordShield',power:0};u.weapon='swordShield';expect(G.dmg(u)).toBe(1);
  u.gear!.weapon={id:'cross',def:'crossbow',power:0};u.weapon='crossbow';expect(G.dmg(u)).toBe(.7);
});
