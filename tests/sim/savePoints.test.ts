import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { chooseEvent, recruitAndClose, beginBattle, resumeTarget, abandonBattle } from '../../src/sim/run/savePoints';
import { pickEvent } from '../../src/sim/run/events';
import { encounterCandidates } from '../../src/sim/run/recruit';
import { newRunV2 } from '../../src/sim/week/week';
import { healOne } from '../../src/sim/run/shop';
import { generateRecruit } from '../../src/sim/roster/generate';
import type { RunState } from '../../src/sim/run/types';

const run = (): RunState => {
  const r = newRunV2(8, 'x');
  const rng = createRng(1);
  const used = new Set<string>();
  return { ...r, gold: 100, roster: { ...r.roster, mercs: [...r.roster.mercs, generateRecruit(rng, { level: 2, usedNames: used, id: 'm1' })], nextId: 2 } };
};

describe('save points (reload safety)', () => {
  it('an event choice clears the volatile state', () => {
    const r = run();
    const view = pickEvent(r, { step: 3, lane: 0 });
    const out = chooseEvent({ ...r, pending: { event: view } }, view, view.choices.find((c) => c.available)!.id);
    expect(out.run.pending).toBeUndefined();
  });
  it('recruiting closes the offer', () => {
    const r = run();
    const c = encounterCandidates(r, { step: 2, lane: 0 }).find((x) => x.fee === 0)!;
    const out = recruitAndClose({ ...r, pending: {} }, c);
    expect(out.pending).toBeUndefined();
    expect(out.roster.mercs).toHaveLength(3);
  });
  it('a battle in progress resumes as abandoned and is settled as a retreat', () => {
    const started = beginBattle(run(), { m0: { col: 2, row: 1 }, m1: { col: 0, row: 1 } });
    expect(resumeTarget(started)).toBe('abandonedBattle');
    const settled = abandonBattle(started);
    expect(settled.pending).toBeUndefined();
    expect(settled.gold).toBe(70);
    expect(settled.roster.mercs.every((m) => m.injury >= 2)).toBe(true);
    expect(resumeTarget(settled)).toBe('week');
  });
  it('abandoning the boss battle loses the run', () => {
    expect(abandonBattle(beginBattle({ ...run(), phase: 'boss' }, { m0: { col: 2, row: 1 } })).status).toBe('lost');
  });
  it('healing refuses mercs that are not injured', () => {
    expect(() => healOne(run(), 'm1')).toThrow();
  });
});
