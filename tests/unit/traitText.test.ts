import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { TRAIT_TEXT, traitText } from '../../src/sim/party/traitText';

describe('traitText', () => {
  it('covers every trait at every rank', () => {
    for (const d of Object.values(TRAITS)) {
      expect(TRAIT_TEXT[d.id], d.id).toBeTypeOf('function');
      for (let r = 1; r <= d.ranks; r++) {
        const text = traitText(d.id, r);
        expect(text.length, `${d.id} r${r}`).toBeGreaterThan(0);
        expect(text).not.toMatch(/undefined|NaN/);
      }
    }
  });
  it('has no text for unknown ids', () => {
    expect(traitText('nope', 1)).toBe('');
  });
  it('states the numbers the code gives', () => {
    expect(traitText('tough', 2)).toBe('최대 체력 +30%');
    expect(traitText('finish', 2)).toBe('처치 → 다음 공격 피해 +75%');
    expect(traitText('sprint', 2)).toBe('이동 +20%');
    expect(traitText('sprint', 3)).toBe('이동 +30% · 3단계: 이동 후 첫 피격 회피');
    expect(traitText('grit', 3)).toBe('죽을 피해를 체력 1로 버팀 (20턴)');
    expect(traitText('immortal', 1)).toBe('죽을 피해 → 3턴 무적 (전투당 1회) · 대가: 체력 -25%');
  });
});
