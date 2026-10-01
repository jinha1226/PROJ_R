import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { newRunV2, startWeek, trainWeek, restWeek, endWeek, canExplore, recruitVisitor, skipStart } from '../../src/sim/week/week';
import { xpToNext } from '../../src/sim/roster/leveling';
import { generateRecruit } from '../../src/sim/roster/generate';
import type { RunState } from '../../src/sim/run/types';
import type { TraitId } from '../../src/data/types';

const withParty = (seed = 4, traits: TraitId[][] = [['loner', 'cautious'], ['calm', 'glory']]): RunState => {
  const r = newRunV2(seed, 'x');
  const rng = createRng(2);
  const used = new Set<string>();
  const extra = traits.map((t, i) => ({ ...generateRecruit(rng, { level: 2, usedNames: used, id: `m${i + 1}` }), traits: t }));
  return { ...r, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra], nextId: traits.length + 1 } };
};

describe('weekly loop', () => {
  it('starts in week 1 with the lone protagonist and three region cards', () => {
    const r = newRunV2(3, 'x');
    expect(r.version).toBe(2);
    expect(r.week).toBe(1);
    expect(r.roster.mercs).toHaveLength(1);
    expect(r.regionCards).toHaveLength(3);
    expect(['start', 'choose']).toContain(r.phase);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
  it('week 2 always brings 1–2 visitors including a free one', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = startWeek({ ...newRunV2(seed, 'x'), week: 2 });
      expect(r.visitors!.length).toBeGreaterThanOrEqual(1);
      expect(r.visitors!.length).toBeLessThanOrEqual(2);
      expect(r.visitors!.some((v) => v.fee === 0)).toBe(true);
    }
  });
  it('visitors show up about 60% of later weeks', () => {
    let n = 0;
    for (let seed = 0; seed < 200; seed++) if (startWeek({ ...newRunV2(seed, 'x'), week: 5 }).visitors?.length) n++;
    expect(n / 200).toBeGreaterThan(0.5);
    expect(n / 200).toBeLessThan(0.7);
  });
  it('recruiting a visitor or skipping moves to the choice phase', () => {
    const r = startWeek({ ...newRunV2(1, 'x'), week: 2 });
    const free = r.visitors!.find((v) => v.fee === 0)!;
    const a = recruitVisitor(r, free);
    expect(a.roster.mercs).toHaveLength(2);
    expect(a.visitors).toBeUndefined();
    expect(skipStart(r).phase).toBe('choose');
  });
  it('training gives 40% of the next level in xp and ends in a report', () => {
    const r = { ...withParty(), phase: 'choose' as const };
    const m1 = r.roster.mercs[1]!;
    const out = trainWeek(r, ['m1']);
    expect(out.report!.xp.m1).toBe(Math.round(xpToNext(m1.level) * 0.4));
    expect(out.phase).toBe('report');
  });
  it('resting heals everyone and lets two members talk', () => {
    const r = { ...withParty(), phase: 'choose' as const };
    r.roster.mercs = r.roster.mercs.map((m) => ({ ...m, injury: 2 }));
    const out = restWeek(r, 'm1', 'm2');
    expect(out.roster.mercs.every((m) => m.injury === 0)).toBe(true);
    expect(out.roster.relations[0]!.affinity).toBe(12);
  });
  it('ending the week heals idle members and advances; week 12 is the boss', () => {
    let r: RunState = { ...withParty(), phase: 'choose' as const };
    r.roster.mercs = r.roster.mercs.map((m) => ({ ...m, injury: 2 }));
    r = trainWeek(r, ['m1']);
    const next = endWeek(r);
    expect(next.week).toBe(2);
    expect(next.roster.mercs.find((m) => m.id === 'm2')!.injury).toBe(1);
    expect(next.roster.mercs.find((m) => m.id === 'm1')!.injury).toBe(2);
    expect(startWeek({ ...r, week: 12 }).phase).toBe('boss');
  });
  it('nobody healthy → no exploring', () => {
    const r = withParty();
    expect(canExplore(r)).toBe(true);
    expect(canExplore({ ...r, roster: { ...r.roster, mercs: r.roster.mercs.map((m) => ({ ...m, injury: 1 })) } })).toBe(false);
  });
  it('is deterministic', () => {
    expect(startWeek({ ...newRunV2(9, 'x'), week: 4 })).toEqual(startWeek({ ...newRunV2(9, 'x'), week: 4 }));
  });
});
