import { expect, it } from 'vitest';
import { blast, CAP, idx, newProbe, tickProbe } from '../../src/sim/raid/hordeProbe';

it('the flow field falls toward the pod and walls cost more to go through', () => {
  const p = newProbe('grid');
  expect(p.dist[idx(p, p.pod.x, p.pod.y)]).toBe(0);
  expect(p.dist[idx(p, 0, 6)]).toBeGreaterThan(p.dist[idx(p, 12, 12)]!);
});

it.each(['grid', 'free'] as const)('%s: the horde flows in, never stands in a wall, and reaches the pod', (mode) => {
  const p = newProbe(mode, 3, 120);
  for (let k = 0; k < 1800; k++) {
    tickProbe(p, 1 / 30);
    for (const f of p.units) expect(p.walls[idx(p, Math.floor(f.x), Math.floor(f.y))], `${mode} in a wall`).toBe(0);
    if (mode === 'grid') { const counts = new Map<number, number>(); for (const f of p.units) counts.set(f.cell, (counts.get(f.cell) ?? 0) + 1); expect(Math.max(0, ...counts.values())).toBeLessThanOrEqual(CAP); }
  }
  expect(p.spawned).toBe(120); expect(p.reached).toBeGreaterThan(0);
});

it('a blast clears the fodder round a point', () => {
  const p = newProbe('free', 2, 60);
  for (let k = 0; k < 120; k++) tickProbe(p, 1 / 30);
  const f = p.units[0]!, before = p.units.length;
  expect(blast(p, f.x, f.y, 2)).toBeGreaterThan(0); expect(p.units.length).toBeLessThan(before);
});

it('a tick of a 150-strong horde stays cheap', () => {
  for (const mode of ['grid', 'free'] as const) {
    const p = newProbe(mode, 5, 150);
    for (let k = 0; k < 600; k++) tickProbe(p, 1 / 30);
    const t0 = performance.now(); for (let k = 0; k < 60; k++) tickProbe(p, 1 / 30);
    expect((performance.now() - t0) / 60, mode).toBeLessThan(4);
  }
});
