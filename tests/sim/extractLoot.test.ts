import { describe, it, expect } from 'vitest';
import { rollContainer, rollDrop } from '../../src/sim/extract/loot';
import { xitem } from '../../src/data/extract';
import type { Container } from '../../src/sim/extract/region';
import type { Stack } from '../../src/sim/extract/inventory';

const box = (kind: Container['kind'], tier = 1, extra?: string[]): Container => ({ id: `c_${kind}`, kind, pos: { x: 0, y: 0 }, tier, extra });
const worth = (s: Stack[]) => s.reduce((a, x) => a + xitem(x.id).value * x.n, 0);
const avg = (f: (seed: number) => number, n = 1000) => { let t = 0; for (let i = 0; i < n; i++) t += f(i * 31 + 7); return t / n; };

describe('loot tables', () => {
  it('the same container and seed always give the same loot', () => {
    expect(rollContainer(box('crate'), 5, 2)).toEqual(rollContainer(box('crate'), 5, 2));
    expect(rollDrop('bandit_archer', 2, 9)).toEqual(rollDrop('bandit_archer', 2, 9));
  });

  it('every roll gives valid, stack-respecting items', () => {
    for (const kind of ['crate', 'supply', 'relic', 'bag', 'herb', 'vault'] as const)
      for (let s = 0; s < 50; s++)
        for (const it of rollContainer(box(kind, 2), s, 3)) {
          expect(it.n).toBeGreaterThan(0);
          expect(it.n).toBeLessThanOrEqual(xitem(it.id).stack);
        }
  });

  it('relic chests are worth far more than crates', () => {
    expect(avg((s) => worth(rollContainer(box('relic', 3), s, 2)))).toBeGreaterThan(3 * avg((s) => worth(rollContainer(box('crate', 1), s, 2))));
  });

  it('containers opened after nightfall (8 min) are richer', () => {
    expect(avg((s) => worth(rollContainer(box('bag', 2), s, 9)))).toBeGreaterThan(avg((s) => worth(rollContainer(box('bag', 2), s, 2))) * 1.1);
  });

  it('the vault always holds a relic; herbs hold only consumables and junk', () => {
    for (let s = 0; s < 100; s++) {
      expect(rollContainer(box('vault', 2), s, 1).some((x) => xitem(x.id).kind === 'relic')).toBe(true);
      expect(rollContainer(box('herb', 0), s, 1).every((x) => ['consumable', 'junk'].includes(xitem(x.id).kind))).toBe(true);
    }
  });

  it('extra items (the vault key) are always included', () => {
    expect(rollContainer(box('crate', 1, ['x_vault_key']), 3, 1).some((x) => x.id === 'x_vault_key')).toBe(true);
  });

  it('enemies drop their kind of loot; the chief always drops his seal', () => {
    const skel = Array.from({ length: 200 }, (_, s) => rollDrop('skeleton_minion', 1, s)).flat();
    expect(skel.some((x) => x.id === 'x_bone')).toBe(true);
    expect(skel.some((x) => x.id === 'x_badge')).toBe(false);
    for (let s = 0; s < 20; s++) expect(rollDrop('bandit_chief', 3, s).some((x) => x.id === 'x_chief_seal')).toBe(true);
  });
});
