import { describe, expect, it } from 'vitest';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { traitText } from '../../src/sim/party/traitText';

describe('traitText', () => {
  it('covers every trait at every rank', () => {
    for (const d of Object.values(TRAITS)) {
      expect(!!d.text, d.id).toBe(true);
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
    expect(traitText('finish', 1)).toBe('처치 → 다음 공격 피해 2배');
    expect(traitText('finish', 2)).toBe('처치 → 다음 공격 피해 2배 · 강화: 최대 4배까지 쌓임');
    expect(traitText('bond', 1)).toBe('2칸 안 아군 1명당 피해 +15%');
    expect(traitText('immortal', 1)).toBe('죽을 피해 → 3턴 무적 (전투당 1회) · 대가: 체력 -25%');
  });
});
