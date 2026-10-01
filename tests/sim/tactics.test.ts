import { describe, it, expect } from 'vitest';
import { setTactic, tacticSlots } from '../../src/sim/roster/tactics';
import { newRoster } from '../../src/sim/roster/generate';

describe('tactic assignment', () => {
  it('slot count follows rank: 1 until veteran, then 2', () => {
    expect(tacticSlots(6)).toBe(1);
    expect(tacticSlots(7)).toBe(2);
  });
  it('assigns owned tactics to open slots without duplicates', () => {
    const r = newRoster(2, 1);
    const out = setTactic(r, 'm1', 0, 'weakHunt');
    expect(out.mercs[1]!.tactics).toEqual(['weakHunt']);
    expect(() => setTactic(r, 'm1', 1, 'guardBack')).toThrow();
    expect(() => setTactic(r, 'm1', 0, 'useCover')).toThrow();
    const vet = { ...r, mercs: r.mercs.map((m) => (m.id === 'm1' ? { ...m, level: 7, tactics: ['weakHunt' as const] } : m)) };
    expect(setTactic(vet, 'm1', 1, 'guardBack').mercs[1]!.tactics).toEqual(['weakHunt', 'guardBack']);
    expect(() => setTactic(vet, 'm1', 1, 'weakHunt')).toThrow();
  });
});
