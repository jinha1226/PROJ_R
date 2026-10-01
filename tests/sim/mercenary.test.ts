import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { TRAITS } from '../../src/data/traits';
import { createProtagonist, generateRecruit, newRoster } from '../../src/sim/roster/generate';
import { mercStats, mercToUnitSetup } from '../../src/sim/roster/toSetup';
import { canEquip, equip, unequip } from '../../src/sim/roster/equipment';
import { autoFormation } from '../../src/sim/roster/formation';
import { rankOf } from '../../src/sim/roster/types';

describe('mercenaries', () => {
  it('generation is deterministic per seed', () => {
    expect(newRoster(42, 4)).toEqual(newRoster(42, 4));
    expect(newRoster(42, 4)).not.toEqual(newRoster(43, 4));
  });
  it('recruits get two distinct, compatible traits and growth within 0.85–1.15', () => {
    const rng = createRng(1);
    const used = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const m = generateRecruit(rng, { level: 1, usedNames: used });
      expect(m.traits).toHaveLength(2);
      expect(m.traits[0]).not.toBe(m.traits[1]);
      expect(TRAITS[m.traits[0]!].dislikes).not.toContain(m.traits[1]);
      expect(m.revealed).toEqual([m.traits[0]]);
      for (const g of Object.values(m.growth)) { expect(g).toBeGreaterThanOrEqual(0.85); expect(g).toBeLessThanOrEqual(1.15); }
      expect(m.gear.weapon).toBeTruthy();
    }
  });
  it('the protagonist starts as a nameless novice with a rusty sword', () => {
    const p = createProtagonist(7);
    expect(p).toMatchObject({ classId: 'novice', name: '이름 없는 모험가', protagonist: true, level: 1 });
    expect(p.gear.weapon).toBe('worn_sword');
  });
  it('stats include growth, gear, injury, and scars', () => {
    const r = newRoster(5, 2);
    const m = { ...r.mercs[1]!, level: 5 };
    const base = mercStats(m);
    expect(mercStats({ ...m, gear: { ...m.gear, armor: 'chain_mail' } }).def).toBeCloseTo(base.def + 8);
    expect(mercStats({ ...m, injury: 2 }).atk).toBeCloseTo(base.atk * 0.85);
    expect(mercStats({ ...m, scars: ['hardened'] }).def).toBeCloseTo(base.def * 1.2);
    expect(mercStats({ ...m, passives: ['toughness'] }).maxHp).toBeCloseTo(base.maxHp * 1.15, 0);
  });
  it('equipment respects weapon type and returns replaced gear to the inventory', () => {
    let r = newRoster(5, 3);
    const p = r.mercs[0]!;
    expect(canEquip(p, 'bloodaxe')).toBe(false);
    expect(() => equip(r, p.id, 'bloodaxe')).toThrow();
    r = { ...r, inventory: ['knight_blade'] };
    const r2 = equip(r, p.id, 'knight_blade');
    expect(r2.mercs[0]!.gear.weapon).toBe('knight_blade');
    expect(r2.inventory).toEqual(['worn_sword']);
    expect(r.mercs[0]!.gear.weapon).toBe('worn_sword');
    const r3 = unequip(r2, p.id, 'weapon');
    expect(r3.mercs[0]!.gear.weapon).toBeUndefined();
    expect(r3.inventory.sort()).toEqual(['knight_blade', 'worn_sword']);
  });
  it('unit setups carry level, traits, gear look, and progression fields', () => {
    const r = newRoster(5, 2);
    const m = { ...r.mercs[1]!, level: 7, gear: { ...r.mercs[1]!.gear, armor: 'guard_plate' }, tempTraits: [{ trait: 'vengeful' as const, battles: 2 }] };
    const u = mercToUnitSetup(m, 0, { col: 2, row: 1 });
    expect(u.id).toBe(m.id);
    expect(u.level).toBe(7);
    expect(u.traits).toContain('vengeful');
    expect(u.gear.cape).toBe(true);
    expect(u.gear.helmet).toBe(true);
    expect(u.uniques).toContain('thorns');
    expect(u.rank).toBe('veteran');
  });
  it('ranks follow level bands', () => {
    expect([1, 3, 4, 6, 7, 9, 10].map(rankOf)).toEqual(['rookie', 'rookie', 'skilled', 'skilled', 'veteran', 'veteran', 'hero']);
  });
  it('auto formation puts melee in front and casters in back', () => {
    const r = newRoster(11, 4);
    const f = autoFormation(r.mercs);
    expect(f.length).toBeLessThanOrEqual(5);
    for (const { merc, col } of f) {
      if (['mage', 'crossbow'].includes(merc.classId)) expect(col).toBe(0);
      if (['warrior', 'berserker', 'rogue', 'novice'].includes(merc.classId)) expect(col).toBe(2);
      if (merc.classId === 'priest') expect(col).toBe(1);
    }
    expect(new Set(f.map((x) => `${x.col},${x.row}`)).size).toBe(f.length);
  });
});
