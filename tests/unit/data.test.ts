import { describe, it, expect } from 'vitest';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import { SKILLS, getSkill } from '../../src/data/skills';
import { ALLY_PRESETS, ENEMY_PRESETS } from '../../src/data/presets';
import { TACTICS } from '../../src/data/tactics';
import { KO } from '../../src/ui/i18n/ko';

const kitOf = (d: { basic: string; actives: string[]; ultimate?: string }) => [
  d.basic,
  ...d.actives,
  ...(d.ultimate ? [d.ultimate] : []),
];

describe('data integrity', () => {
  it('every class/enemy skill exists', () => {
    for (const c of Object.values(CLASSES)) for (const s of kitOf(c)) expect(() => getSkill(s), `${c.id}:${s}`).not.toThrow();
    for (const e of Object.values(ENEMIES)) for (const s of kitOf(e)) expect(() => getSkill(s), `${e.id}:${s}`).not.toThrow();
  });
  it('getSkill throws on unknown ids', () => {
    expect(() => getSkill('nope')).toThrow();
  });
  it('skill kinds match their kit slot', () => {
    for (const d of [...Object.values(CLASSES), ...Object.values(ENEMIES)]) {
      expect(getSkill(d.basic).kind, d.id).toBe('basic');
      for (const a of d.actives) expect(getSkill(a).kind, `${d.id}:${a}`).toBe('active');
      if (d.ultimate) expect(getSkill(d.ultimate).kind).toBe('ultimate');
    }
  });
  it('summons reference existing enemies', () => {
    for (const s of Object.values(SKILLS))
      for (const ef of s.effects) if (ef.type === 'summon') expect(ENEMIES[ef.enemyId]).toBeDefined();
  });
  it('presets reference existing defs', () => {
    for (const p of Object.values(ALLY_PRESETS)) for (const m of p) expect(CLASSES[m.classId]).toBeDefined();
    for (const p of Object.values(ENEMY_PRESETS)) for (const m of p.members) expect(ENEMIES[m.enemyId]).toBeDefined();
  });
  it('every id has a Korean name', () => {
    for (const id of Object.keys(CLASSES)) expect(KO.class[id as keyof typeof KO.class], id).toBeTruthy();
    for (const id of Object.keys(SKILLS)) expect(KO.skill[id], id).toBeTruthy();
    for (const id of Object.keys(ENEMIES)) expect(KO.enemy[id], id).toBeTruthy();
    for (const id of TACTICS) expect(KO.tactic[id], id).toBeTruthy();
  });
  it('timings are positive and basics have no cooldown', () => {
    for (const s of Object.values(SKILLS)) {
      expect(s.windup, s.id).toBeGreaterThan(0);
      expect(s.active, s.id).toBeGreaterThan(0);
      expect(s.recovery, s.id).toBeGreaterThan(0);
      if (s.kind === 'basic') expect(s.cooldown, s.id).toBe(0);
    }
  });
});
