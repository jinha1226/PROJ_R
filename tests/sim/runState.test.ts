import { describe, it, expect } from 'vitest';
import { newRun, reachable, enterNode } from '../../src/sim/run/state';

describe('run state', () => {
  it('starts with the lone protagonist, 60 gold, and the whole first step reachable', () => {
    const r = newRun(5, '2026-10-01');
    expect(r.roster.mercs).toHaveLength(1);
    expect(r.roster.mercs[0]!.protagonist).toBe(true);
    expect(r.gold).toBe(60);
    expect(r.status).toBe('active');
    expect(reachable(r).map((n) => n.step)).toEqual([1, 1, 1]);
  });
  it('entering moves along edges only', () => {
    let r = newRun(5, 'x');
    const first = reachable(r)[0]!;
    r = enterNode(r, first.id);
    expect(r.at).toBe(first.id);
    expect(r.visited).toContain(first.id);
    const next = reachable(r);
    expect(next.every((n) => first.next.includes(n.id))).toBe(true);
    const far = Object.values(r.map.nodes).find((n) => n.step === 5)!;
    expect(() => enterNode(r, far.id)).toThrow();
  });
  it('is JSON round-trippable', () => {
    const r = newRun(5, 'x');
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
