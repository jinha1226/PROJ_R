import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sa = Array.from({ length: 5 }, () => a.next());
    const sb = Array.from({ length: 5 }, () => b.next());
    expect(sa).toEqual(sb);
  });
  it('differs across seeds and stays in [0,1)', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('int is inclusive and pick/shuffle use all items', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(r.pick(['a'])).toBe('a');
    expect(() => r.pick([])).toThrow();
  });
});
