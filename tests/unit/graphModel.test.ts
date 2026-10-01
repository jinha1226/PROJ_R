import { describe, it, expect } from 'vitest';
import { graphModel, EDGE_COLORS } from '../../src/ui/run/graphModel';
import { newRoster } from '../../src/sim/roster/generate';

describe('relation graph model', () => {
  it('lays members on a circle and colors edges by their strongest relationship', () => {
    const r = newRoster(3, 3);
    const roster = { ...r, relations: [
      { a: 'm0', b: 'm1', affinity: 85, rival: false, battlesTogether: 12, contests: 0 },
      { a: 'm2', b: 'm3', affinity: -60, rival: false, battlesTogether: 2, contests: 0 },
      { a: 'm1', b: 'm2', affinity: 10, rival: false, battlesTogether: 1, contests: 0 },
    ] };
    const g = graphModel(roster, 300);
    expect(g.nodes).toHaveLength(4);
    for (const n of g.nodes) expect(Math.hypot(n.x - 150, n.y - 150)).toBeCloseTo(110, 0);
    expect(g.edges).toHaveLength(2);
    expect(g.edges.find((e) => e.a === 'm0')!.color).toBe(EDGE_COLORS.comrade);
    expect(g.edges.find((e) => e.a === 'm2')!.color).toBe(EDGE_COLORS.feud);
  });
});
