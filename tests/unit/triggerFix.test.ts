import { expect, it } from 'vitest';
import { CATALOG } from '../../src/sim/delve/catalog';
import { starterGear } from '../../src/sim/delve/gear';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { damage, entOf, passiveMult, stats, stepToward, strike, targetOf } from '../../src/sim/party/partyCore';
import { heal } from '../../src/sim/party/kitEffects';
import { action, emit, type TriggerDef } from '../../src/sim/party/triggers';
import { triggerText } from '../../src/sim/party/triggerText';

const archer = () => {
  const p = partyRoom(), u = p.units[0]!, f = p.units[3]!;
  u.cls = 'archer'; u.weapon = 'longbow';
  entOf(p, f.id)!.hp = 900; entOf(p, f.id)!.maxHp = 1000;
  entOf(p, f.id)!.pos = { x: 8, y: 4 };
  strike(p, u, f, 0, []); strike(p, u, f, 1, []);
  expect(u.steady).toBe(2);
  return { p, u, f };
};
it('steady aim resets on a one-cell move and rebuilds after the first unbonused attack', () => {
  const { p, u, f } = archer();
  expect(stepToward(p, u, { x: 4, y: 4 }, 2, [])).toBe(true);
  expect(u.steady).toBe(0); expect(passiveMult(p, u, f, 2, [])).toBe(1);
  strike(p, u, f, 2, []); expect(u.steady).toBe(0);
  strike(p, u, f, 3, []); expect(u.steady).toBe(1);
});
it('steady aim also resets when an archer rolls away', () => {
  const { p, u, f } = archer();
  entOf(p, f.id)!.pos = { x: 4, y: 4 };
  for (const v of p.units) v.nextAt = 100;
  u.nextAt = 0; u.manualSkills = true;
  expect(tick(p, .1).some(e => e.text === 'roll')).toBe(true);
  expect(u.steady).toBe(0);
});
it('catalog trigger ids are unique per distinct TriggerDef object', () => {
  const byId = new Map<string, TriggerDef>();
  for (const item of Object.values(CATALOG)) for (const def of item.triggers) {
    const previous = byId.get(def.id);
    if (previous) expect(def, `${item.id}: ${def.id}`).toBe(previous);
    byId.set(def.id, def);
  }
});
it('pilgrim relic and robe each have their own effect description', () => {
  expect(CATALOG.pilgrimRobe!.triggers[0]!.id).toBe('순례자의 기도');
  expect(triggerText('순례의 빛')).toBe('치유 → 치유받은 아군 1칸 안 적에게 피해 5');
  expect(triggerText('순례자의 기도')).toBe('위기 → 자신 치유 12');
});
it('cloth breath hides the wearer for one full turn from combat start', () => {
  const p = partyRoom(), u = p.units[0]!;
  u.gear = { weapon: null, armor: { id: 'cloth', def: 'cloth', power: 0 }, accessory: null };
  emit(p, 'combatStart', { t: 7, src: u, ev: [] });
  expect(u.hiddenUntil).toBe(8);
  expect(triggerText('숨 고르기')).toBe('전투 시작 → 1턴 은신');
});
it('bait taunts foes within three cells for two turns for a non-warrior wearer', () => {
  const p = partyRoom(), u = p.units[1]!, f = p.units[3]!, far = p.units[4]!;
  u.cls = 'archer'; u.gear = starterGear('archer', () => u.id);
  u.gear.accessory = { id: 'bait', def: 'baitCharm', power: 0 };
  entOf(p, f.id)!.pos = { x: 5, y: 3 }; // exactly three cells from the wearer
  entOf(p, far.id)!.pos = { x: 6, y: 3 };
  f.order = { kind: 'attack', target: p.units[0]!.id };
  emit(p, 'combatStart', { t: 7, src: u, ev: [] });
  expect(f.tauntBy).toBe(u.id); expect(f.tauntUntil).toBe(9);
  expect(targetOf(p, f, 8.99)).toBe(u); expect(targetOf(p, f, 9)).toBe(p.units[0]);
  expect(far.tauntBy).toBeUndefined(); expect(f.status.exposed).toBeUndefined();
});
it('berserker low health stays accurate when damage exhausts the trigger budget and healing reaches half', () => {
  const p = partyRoom(), u = p.units[0]!, actor = p.units[1]!, e = entOf(p, u.id)!;
  u.cls = 'berserker'; u.weapon = 'greataxe'; u.shield = 0;
  e.hp = e.maxHp = 100; const before = stats(u).atk;
  actor.triggers = Array.from({ length: 5 }, (_, i) => ({
    id: `budget${i}`, when: 'hit', run: () => { actor.progress++; },
  }));
  action(p, () => {
    emit(p, 'hit', { t: 0, src: actor, ev: [] });
    damage(p, 0, 'trap', u, 60, []);
  });
  expect(actor.progress).toBe(5); expect(e.hp).toBe(40);
  expect(u.lowHp).toBe(true); expect(stats(u).atk).toBe(before / 2);
  heal(p, u, u, 10, 1, []);
  expect(u.lowHp).toBe(false); expect(stats(u).atk).toBe(before);
  heal(p, u, u, 20, 2, []); expect(stats(u).atk).toBe(before);
});
it('berserker combat stats compute the bonus from current health instead of a stale flag', () => {
  const p = partyRoom(), u = p.units[0]!, e = entOf(p, u.id)!;
  u.cls = 'berserker'; u.weapon = 'swordShield';
  e.hp = e.maxHp = 100; const before = stats(u, 0, p).atk;
  e.hp = 40; u.lowHp = false; expect(stats(u, 0, p).atk).toBe(before / 2);
  e.hp = 60; u.lowHp = true; expect(stats(u, 0, p).atk).toBe(before);
});
it('counter description explicitly states its block requirement', () => {
  expect(triggerText('응수')).toContain('막기 시');
});
it('steady aim drops once the fight is over', () => {
  const { p, u } = archer();
  p.combat = false; tick(p, 0.1);
  expect(u.steady ?? 0).toBe(0); expect(u.still).toBe(0);
});
