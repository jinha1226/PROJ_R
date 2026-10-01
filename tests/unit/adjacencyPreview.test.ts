import { describe, it, expect } from 'vitest';
import { adjacencyPreview } from '../../src/ui/run/adjacency';
import { newRoster } from '../../src/sim/roster/generate';

describe('formation adjacency preview', () => {
  const r = { ...newRoster(5, 3), relations: [
    { a: 'm0', b: 'm1', affinity: 50, rival: false, battlesTogether: 1, contests: 0 },
    { a: 'm1', b: 'm2', affinity: -60, rival: false, battlesTogether: 1, contests: 0 },
    { a: 'm0', b: 'm3', affinity: 85, rival: false, battlesTogether: 11, contests: 0 },
  ] };
  it('lists effects only for pairs placed close enough', () => {
    const near = adjacencyPreview(r, { m0: { col: 2, row: 1 }, m1: { col: 2, row: 2 }, m2: { col: 0, row: 3 } });
    expect(near.some((l) => l.kind === 'friend' && l.text.includes('방어'))).toBe(true);
    expect(near.some((l) => l.kind === 'feud')).toBe(false);
    const far = adjacencyPreview(r, { m0: { col: 2, row: 0 }, m1: { col: 0, row: 3 } });
    expect(far.some((l) => l.kind === 'friend')).toBe(false);
  });
  it('shows feuds side by side and comrade combos within reach', () => {
    const lines = adjacencyPreview(r, { m1: { col: 1, row: 1 }, m2: { col: 1, row: 2 }, m0: { col: 2, row: 0 }, m3: { col: 1, row: 0 } });
    expect(lines.some((l) => l.kind === 'feud' && l.text.includes('공격'))).toBe(true);
    expect(lines.some((l) => l.kind === 'comrade')).toBe(true);
  });
});
