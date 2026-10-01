import { describe, it, expect } from 'vitest';
import { CLASSES } from '../../src/data/classes';
import { getSkill } from '../../src/data/skills';
import { PASSIVES } from '../../src/data/passives';
import { ITEMS, WEAPON_TYPE_OF_CLASS } from '../../src/data/items';
import { SCARS } from '../../src/data/scars';
import { TITLES } from '../../src/data/titles';
import { NAMES, BACKSTORIES } from '../../src/data/names';
import { KO } from '../../src/ui/i18n/ko';

const combatClasses = Object.values(CLASSES).filter((c) => c.id !== 'novice');

describe('growth data', () => {
  it('each combat class has a pool of 5 actives that includes its starting actives', () => {
    for (const c of combatClasses) {
      expect(c.pool, c.id).toHaveLength(5);
      for (const a of c.actives) expect(c.pool).toContain(a);
      for (const s of c.pool) expect(getSkill(s).kind, s).toBe('active');
    }
  });
  it('the learnable pool totals 36 (30 class actives + 6 passives)', () => {
    const classSkills = new Set(combatClasses.flatMap((c) => c.pool));
    expect(classSkills.size + Object.keys(PASSIVES).length).toBe(36);
  });
  it('30 items: 12 weapons, 10 armors, 8 trinkets; every class has a weapon type with worn gear', () => {
    const items = Object.values(ITEMS);
    expect(items).toHaveLength(30);
    expect(items.filter((i) => i.slot === 'weapon')).toHaveLength(12);
    expect(items.filter((i) => i.slot === 'armor')).toHaveLength(10);
    expect(items.filter((i) => i.slot === 'trinket')).toHaveLength(8);
    for (const c of Object.values(CLASSES)) {
      const wt = WEAPON_TYPE_OF_CLASS[c.id];
      expect(items.some((i) => i.slot === 'weapon' && i.weaponType === wt && i.tier === 0), c.id).toBe(true);
    }
  });
  it('every growth id has a Korean name', () => {
    for (const c of combatClasses) for (const s of c.pool) expect(KO.skill[s], s).toBeTruthy();
    for (const id of Object.keys(PASSIVES)) expect(KO.passive[id], id).toBeTruthy();
    for (const id of Object.keys(ITEMS)) expect(KO.item[id], id).toBeTruthy();
    for (const id of Object.keys(SCARS)) expect(KO.scar[id], id).toBeTruthy();
    for (const id of Object.keys(TITLES)) expect(KO.title[id], id).toBeTruthy();
    for (const i of Object.values(ITEMS)) if (i.unique) expect(KO.unique[i.unique], i.unique).toBeTruthy();
  });
  it('has enough unique names and backstories', () => {
    expect(new Set(NAMES).size).toBe(NAMES.length);
    expect(NAMES.length).toBeGreaterThanOrEqual(40);
    expect(BACKSTORIES.length).toBeGreaterThanOrEqual(20);
  });
  it('titles check their records', () => {
    const rec = { battles: 0, kills: 0, rescues: 3, downedSurvived: 0, bossKills: 0, dodges: 0, healing: 0 };
    expect(TITLES.guardian.check(rec)).toBe(true);
    expect(TITLES.hundredCuts.check(rec)).toBe(false);
  });
});
