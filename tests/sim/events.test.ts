import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { pickEvent, resolveEvent, applyEffects } from '../../src/sim/run/events';
import { EVENT_DEFS } from '../../src/sim/run/eventDefs';
import { newRun } from '../../src/sim/run/state';
import { generateRecruit } from '../../src/sim/roster/generate';
import { KO } from '../../src/ui/i18n/ko';
import type { TraitId } from '../../src/data/types';
import type { MapNode, RunState } from '../../src/sim/run/types';

const party = (traits: TraitId[][], gold = 100): RunState => {
  const r = newRun(9, 'x');
  const rng = createRng(1);
  const used = new Set<string>();
  const extra = traits.map((t, i) => ({ ...generateRecruit(rng, { level: 2, usedNames: used, id: `m${i + 1}` }), traits: t }));
  return { ...r, gold, roster: { ...r.roster, mercs: [{ ...r.roster.mercs[0]!, traits: ['calm', 'glory'] as TraitId[] }, ...extra], nextId: traits.length + 1 } };
};
const node = (r: RunState, lane: 0 | 1 | 2 = 0): MapNode => ({ ...Object.values(r.map.nodes).find((n) => n.step === 5 && n.lane === lane)!, type: 'event' });
const forced = (r: RunState, id: string) => pickEvent(r, node(r), id);

describe('events', () => {
  it('every event has Korean text and there is always an eligible event', () => {
    for (const e of EVENT_DEFS) {
      expect(KO.event[`${e.id}.title`], e.id).toBeTruthy();
      expect(KO.event[`${e.id}.body`], e.id).toBeTruthy();
      for (const c of e.choices) expect(KO.event[c.textKey], c.textKey).toBeTruthy();
    }
    for (let seed = 0; seed < 20; seed++) expect(pickEvent({ ...newRun(seed, 'x') }, node(newRun(seed, 'x'))).choices.length).toBeGreaterThan(0);
  });
  it('the merchant quarrel needs a hothead; the calm option needs a calm member', () => {
    expect(() => forced(party([['reckless', 'chatty']]), 'merchant')).toThrow();
    const v = forced(party([['hotheaded', 'chatty']]), 'merchant');
    expect(v.choices.find((c) => c.id === 'mediate')?.available).toBe(true);
    expect(v.vars.hothead).toBeTruthy();
  });
  it('choices apply their effects to the run', () => {
    const r = party([['hotheaded', 'chatty']]);
    const v = forced(r, 'merchant');
    const out = resolveEvent(r, v, 'side');
    expect(out.run.gold).toBe(r.gold - 20);
    const rel = out.run.roster.relations.find((x) => [x.a, x.b].includes('m1') && [x.a, x.b].includes('m0'));
    expect(rel?.affinity).toBe(10);
  });
  it('a gamble cannot be taken without the stake', () => {
    const v = forced(party([['loner', 'cautious']], 10), 'gambler');
    expect(v.choices.find((c) => c.id === 'bet')?.available).toBe(false);
  });
  it('relic gives an unowned tactic card', () => {
    const r = party([['loner', 'cautious']]);
    const out = resolveEvent(r, forced(r, 'relic'), 'take');
    expect(out.run.roster.tacticsOwned.length).toBe(r.roster.tacticsOwned.length + 1);
  });
  it('competitive sparring creates a rivalry', () => {
    const r = party([['competitive', 'chatty'], ['competitive', 'loner']]);
    const v = forced(r, 'training');
    expect(v.choices.find((c) => c.id === 'spar')?.available).toBe(true);
    const out = resolveEvent(r, v, 'spar');
    expect(out.run.roster.relations.some((x) => x.rival)).toBe(true);
  });
  it('applyEffects clamps gold and affinity', () => {
    const r = party([['loner', 'cautious']], 5);
    const out = applyEffects(r, [{ kind: 'gold', amount: -50 }, { kind: 'affinity', a: 'm0', b: 'm1', amount: 500 }]);
    expect(out.gold).toBe(0);
    expect(out.roster.relations[0]!.affinity).toBe(100);
  });
  it('is deterministic', () => {
    const r = party([['hotheaded', 'coward'], ['protective', 'calm']]);
    expect(pickEvent(r, node(r))).toEqual(pickEvent(r, node(r)));
  });
});
