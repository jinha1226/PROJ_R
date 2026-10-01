import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { chooseEvent, recruitAndClose, beginBattle, resumeTarget, abandonBattle } from '../../src/sim/run/savePoints';
import { pickEvent } from '../../src/sim/run/events';
import { encounterCandidates } from '../../src/sim/run/recruit';
import { newRun, enterNode, reachable } from '../../src/sim/run/state';
import { healOne } from '../../src/sim/run/shop';
import { generateRecruit } from '../../src/sim/roster/generate';
import type { RunState } from '../../src/sim/run/types';

const at = (type: 'event' | 'encounter' | 'battle'): RunState => {
  let r = newRun(8, 'x');
  r = enterNode(r, reachable(r)[0]!.id);
  const node = r.map.nodes[r.at!]!;
  r = { ...r, map: { ...r.map, nodes: { ...r.map.nodes, [node.id]: { ...node, type } } } };
  const rng = createRng(1);
  const used = new Set<string>();
  return { ...r, gold: 100, roster: { ...r.roster, mercs: [...r.roster.mercs, generateRecruit(rng, { level: 2, usedNames: used, id: 'm1' })], nextId: 2 } };
};

describe('save points (reload safety)', () => {
  it('an event choice closes the node so a reload cannot resolve it again', () => {
    const r = at('event');
    const node = r.map.nodes[r.at!]!;
    const view = pickEvent(r, node);
    const choice = view.choices.find((c) => c.available)!;
    const out = chooseEvent({ ...r, pending: { nodeId: node.id, event: view } }, view, choice.id);
    expect(out.run.pending).toBeUndefined();
    expect(resumeTarget(out.run)).toBe('map');
  });
  it('recruiting closes the encounter before the name prompt', () => {
    const r = at('encounter');
    const node = r.map.nodes[r.at!]!;
    const candidates = encounterCandidates(r, node);
    const out = recruitAndClose({ ...r, pending: { nodeId: node.id, candidates } }, candidates.find((c) => c.fee === 0)!);
    expect(out.pending).toBeUndefined();
    expect(out.roster.mercs).toHaveLength(3);
  });
  it('a battle in progress resumes as abandoned and is settled as a retreat', () => {
    const r = at('battle');
    const started = beginBattle(r, { m0: { col: 2, row: 1 }, m1: { col: 0, row: 1 } });
    expect(started.pending?.inBattle).toBe(true);
    expect(resumeTarget(started)).toBe('abandonedBattle');
    const settled = abandonBattle(started);
    expect(settled.pending).toBeUndefined();
    expect(settled.gold).toBe(Math.floor(100 * 0.7));
    expect(settled.roster.mercs.every((m) => m.injury >= 2)).toBe(true);
    expect(resumeTarget(settled)).toBe('map');
  });
  it('a node entered but not started resumes into the node', () => {
    const r = at('battle');
    expect(resumeTarget(r)).toBe('node');
  });
  it('healing refuses mercs that are not injured', () => {
    const r = at('battle');
    expect(() => healOne(r, 'm1')).toThrow();
  });
});
