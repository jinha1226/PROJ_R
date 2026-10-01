import { describe, it, expect } from 'vitest';
import { UnitPool } from '../../src/view/world/unitPool';
import { visionAlpha } from '../../src/view/world/visionMath';

interface Fake { key: string; n: number; shown: boolean }

describe('unit pool', () => {
  const make = () => {
    let made = 0;
    const pool = new UnitPool<{ id: string; kind: string }, Fake>({
      keyOf: (s) => s.kind,
      create: (s) => ({ key: s.kind, n: ++made, shown: true }),
      show: (a) => { a.shown = true; },
      hide: (a) => { a.shown = false; },
    });
    return { pool, made: () => made };
  };

  it('gives each visible unit an actor and takes it back when the unit leaves', () => {
    const { pool } = make();
    const r = pool.sync([{ id: 'a', kind: 'skel' }, { id: 'b', kind: 'bandit' }]);
    expect(r.added.sort()).toEqual(['a', 'b']);
    expect(pool.get('a')!.shown).toBe(true);
    const r2 = pool.sync([{ id: 'b', kind: 'bandit' }]);
    expect(r2.removed).toEqual(['a']);
    expect(pool.get('a')).toBeUndefined();
  });

  it('reuses a released actor of the same kind instead of building a new one', () => {
    const { pool, made } = make();
    pool.sync([{ id: 'a', kind: 'skel' }]);
    const first = pool.get('a')!;
    pool.sync([]);
    expect(first.shown).toBe(false);
    pool.sync([{ id: 'c', kind: 'skel' }]);
    expect(pool.get('c')).toBe(first);
    expect(first.shown).toBe(true);
    pool.sync([{ id: 'c', kind: 'skel' }, { id: 'd', kind: 'bandit' }]);
    expect(made()).toBe(2);
  });

  it('throws away actors that cannot be reused (a corpse) instead of pooling them', () => {
    const dropped: Fake[] = [];
    const pool = new UnitPool<{ id: string; kind: string }, Fake>({
      keyOf: (s) => s.kind, create: (s) => ({ key: s.kind, n: 1, shown: true }), show: () => {}, hide: () => {},
      reusable: (a) => a.n !== 99, drop: (a) => dropped.push(a),
    });
    pool.sync([{ id: 'a', kind: 'skel' }]);
    pool.get('a')!.n = 99;
    pool.sync([]);
    expect(dropped.length).toBe(1);
    pool.sync([{ id: 'b', kind: 'skel' }]);
    expect(pool.get('b')!.n).toBe(1);
  });

  it('lists every live actor', () => {
    const { pool } = make();
    pool.sync([{ id: 'a', kind: 'skel' }, { id: 'b', kind: 'skel' }]);
    expect([...pool.live().keys()].sort()).toEqual(['a', 'b']);
  });
});

describe('vision falloff', () => {
  it('is clear inside the radius and dark well outside', () => {
    expect(visionAlpha(0, 18)).toBe(0);
    expect(visionAlpha(17.9, 18)).toBe(0);
    expect(visionAlpha(20, 18)).toBeGreaterThan(0);
    expect(visionAlpha(20, 18)).toBeLessThan(visionAlpha(24, 18));
    expect(visionAlpha(100, 18)).toBeCloseTo(0.82);
  });
});
