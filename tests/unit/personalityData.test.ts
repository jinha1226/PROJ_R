import { describe, it, expect } from 'vitest';
import { TRAITS } from '../../src/data/traits';
import { EMOTIONS } from '../../src/data/emotions';
import { COMBOS, GENERIC_COMBO } from '../../src/data/combos';
import { getSkill } from '../../src/data/skills';
import { ALLY_PRESETS, ALLY_RELATIONS } from '../../src/data/presets';
import { KO } from '../../src/ui/i18n/ko';
import { BARKS } from '../../src/ui/i18n/barks';

describe('personality data', () => {
  it('has 12 traits with valid likes/dislikes and Korean names', () => {
    expect(Object.keys(TRAITS)).toHaveLength(12);
    for (const tr of Object.values(TRAITS)) {
      for (const o of [...tr.likes, ...tr.dislikes]) expect(TRAITS[o], `${tr.id}->${o}`).toBeDefined();
      expect(KO.trait[tr.id], tr.id).toBeTruthy();
      expect(KO.traitDesc[tr.id], tr.id).toBeTruthy();
    }
  });
  it('has 6 emotions with Korean names', () => {
    expect(Object.keys(EMOTIONS)).toHaveLength(6);
    for (const id of Object.keys(EMOTIONS)) expect(KO.emotion[id], id).toBeTruthy();
  });
  it('combo skills exist and class pairs are unique', () => {
    const pairs = new Set<string>();
    for (const c of [...COMBOS, GENERIC_COMBO]) {
      expect(() => getSkill(c.skill), c.id).not.toThrow();
      expect(() => getSkill(c.partnerSkill), c.id).not.toThrow();
      expect(KO.combo[c.id], c.id).toBeTruthy();
    }
    for (const c of COMBOS) {
      const key = [...c.classes].sort().join('+');
      expect(pairs.has(key), key).toBe(false);
      pairs.add(key);
      expect(c.classes).toContain(c.lead);
    }
    expect(COMBOS).toHaveLength(8);
  });
  it('preset relations reference preset members', () => {
    for (const [key, rels] of Object.entries(ALLY_RELATIONS)) {
      const ids = new Set((ALLY_PRESETS[key] ?? []).map((_, i) => `a${i}`));
      for (const r of rels) {
        expect(ids.has(r.a), `${key}:${r.a}`).toBe(true);
        expect(ids.has(r.b), `${key}:${r.b}`).toBe(true);
      }
    }
    expect(ALLY_PRESETS.bonds).toHaveLength(5);
  });
  it('every bark key has lines', () => {
    for (const k of ['protect', 'rivalry', 'rivalKill', 'revenge', 'courage', 'fear', 'rage', 'combo', 'feud', 'rescued', 'downedFriend', 'mentor'])
      expect(BARKS[k]?.length, k).toBeGreaterThanOrEqual(3);
  });
});
