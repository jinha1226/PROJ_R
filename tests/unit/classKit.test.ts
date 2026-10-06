import { it, expect } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { entOf, stats } from '../../src/sim/party/partyCore';
import { emit, sourcesOf } from '../../src/sim/party/triggers';
import { KITS, promotionOptions, promote } from '../../src/sim/party/classKit';
import { aiUltimate, useUltimate } from '../../src/sim/party/ultimate';
import { BASE_CLASSES, type ClassId } from '../../src/sim/party/partyDefs';
import type { GEvent } from '../../src/sim/grid/types';
it.each(BASE_CLASSES)('%s has two innate sources with working conditions', (cls) => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!, ev: GEvent[] = [];
  u.cls = cls; u.weapon = { warrior: 'swordShield', archer: 'longbow', mage: 'staff', cleric: 'mace', rogue: 'daggers' }[cls] as typeof u.weapon;
  expect(sourcesOf(p, u)).toHaveLength(2);
  entOf(p, f.id)!.pos = { x: 4, y: 4 }; entOf(p, p.units[4]!.id)!.pos = { x: 3, y: 5 };
  entOf(p, p.units[1]!.id)!.hp = 1; u.nth = 3; u.still = 1;
  for (const d of KITS[cls].innate) emit(p, d.when, { t: 0, src: u, target: d.when === 'allyCrisis' ? p.units[1] : f, ev, amount: 8 });
  expect(ev.filter(e => e.type === 'buff').length).toBeGreaterThan(0);
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
it('recounts shield gear and ranks before promoting', () => {
  const p = partyRoom(), u = p.units[0]!; u.level = 8; u.traits = { shieldPro: 3 };
  expect(promotionOptions(p, u).find(o=>o.to==='guardian')?.met).toBe(true);
  u.weapon = 'greataxe'; expect(promotionOptions(p, u).find(o=>o.to==='guardian')?.met).toBe(false);
  expect(promote(p, u.id, 'guardian')).toEqual([]); u.weapon = 'swordShield'; expect(promote(p, u.id, 'guardian').length).toBe(1);
});
it('offers veteran at ten only when no other rule is met', () => {
  const p = partyRoom(), u = p.units[0]!; u.weapon = 'greataxe'; u.level = 9;
  expect(promotionOptions(p, u).find(o=>o.to==='veteran')?.met).toBe(false);
  u.level = 10; expect(promotionOptions(p, u).find(o=>o.to==='veteran')?.met).toBe(true);
});
it('AI recognises clustered foes and sanctuary protects hurt allies', () => {
  const p = partyRoom(), u = p.units[2]!; u.cls = 'cleric'; u.weapon = 'symbol';
  entOf(p, p.units[0]!.id)!.hp = 10;
  expect(aiUltimate(p, u)).not.toBeNull(); useUltimate(p, u.id);
  expect(p.units[0]!.immuneUntil).toBe(3); expect(stats(u).atk).toBeGreaterThan(0);
});
