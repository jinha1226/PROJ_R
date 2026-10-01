import { describe, it, expect } from 'vitest';
import { encounterCandidates, recruit, nameProtagonist, ROSTER_CAP } from '../../src/sim/run/recruit';
import { newRun } from '../../src/sim/run/state';
import type { MapNode, RunState } from '../../src/sim/run/types';

const node = (r: RunState, step = 2): MapNode => ({ ...Object.values(r.map.nodes).find((n) => n.step === step)!, type: 'encounter' });

describe('encounters and recruiting', () => {
  it('offers 2–3 candidates around step/2 level, exactly one free', () => {
    const r = newRun(3, 'x');
    const c = encounterCandidates(r, node(r, 6));
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c.length).toBeLessThanOrEqual(3);
    expect(c.filter((x) => x.fee === 0)).toHaveLength(1);
    for (const x of c) expect(x.merc.level).toBe(3);
    expect(new Set(c.map((x) => x.merc.id)).size).toBe(c.length);
  });
  it('about 20% of candidates come with a past relationship', () => {
    let past = 0;
    let total = 0;
    for (let seed = 0; seed < 120; seed++) {
      const r = newRun(seed, 'x');
      for (const c of encounterCandidates(r, node(r, 4))) { total++; if (c.past) past++; }
    }
    expect(past / total).toBeGreaterThan(0.1);
    expect(past / total).toBeLessThan(0.3);
  });
  it('recruiting pays the fee, adds the merc, and records the past relationship', () => {
    const r = { ...newRun(3, 'x'), gold: 100 };
    const c = { ...encounterCandidates(r, node(r))[0]!, fee: 40, past: { with: 'm0', kind: 'rival' as const } };
    const out = recruit(r, c);
    expect(out.gold).toBe(60);
    expect(out.roster.mercs.map((m) => m.id)).toContain(c.merc.id);
    expect(out.roster.relations.find((x) => x.a === c.merc.id || x.b === c.merc.id)?.rival).toBe(true);
  });
  it('refuses when the company is full or gold is short', () => {
    const r = newRun(3, 'x');
    const c = encounterCandidates(r, node(r))[0]!;
    expect(() => recruit({ ...r, gold: 0 }, { ...c, fee: 10 })).toThrow();
    const full = { ...r, roster: { ...r.roster, mercs: Array.from({ length: ROSTER_CAP }, (_, i) => ({ ...r.roster.mercs[0]!, id: `x${i}` })) } };
    expect(() => recruit(full, { ...c, fee: 0 })).toThrow();
  });
  it('names the protagonist (trimmed, max 12 chars, blank keeps the default)', () => {
    const r = newRun(3, 'x');
    expect(nameProtagonist(r, '  하늘  ').roster.mercs[0]!.name).toBe('하늘');
    expect(nameProtagonist(r, '가'.repeat(20)).roster.mercs[0]!.name).toHaveLength(12);
    const blank = nameProtagonist(r, '   ');
    expect(blank.roster.mercs[0]!.name).toBe('이름 없는 모험가');
    expect(blank.namedProtagonist).toBe(true);
  });
});
