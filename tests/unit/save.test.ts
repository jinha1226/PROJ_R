import { describe, it, expect } from 'vitest';
import { saveRun, loadRun, clearRun, addHall, loadHall, type KV, type HallEntry } from '../../src/app/save';
import { newRunV2 as newRun } from '../../src/sim/week/week';

const memKV = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
};
const entry = (i: number): HallEntry => ({ companyName: `단${i}`, protagonist: 'p', result: 'won', step: 12, survivors: [], fallen: [], date: `2026-10-${String(i).padStart(2, '0')}`, seed: i });

describe('save', () => {
  it('round-trips a run', () => {
    const kv = memKV();
    const r = newRun(3, '2026-10-01');
    expect(saveRun(r, kv)).toBe(true);
    expect(loadRun(kv)).toEqual(r);
    clearRun(kv);
    expect(loadRun(kv)).toBeNull();
  });
  it('rejects corrupt, old, or incomplete saves', () => {
    const kv = memKV();
    kv.setItem('projr.run.v2', '{not json');
    expect(loadRun(kv)).toBeNull();
    kv.setItem('projr.run.v2', JSON.stringify({ ...newRun(1, 'x'), version: 1 }));
    expect(loadRun(kv)).toBeNull();
    kv.setItem('projr.run.v2', JSON.stringify({ version: 1, seed: 1 }));
    expect(loadRun(kv)).toBeNull();
  });
  it('survives a storage that throws', () => {
    const bad: KV = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(saveRun(newRun(1, 'x'), bad)).toBe(false);
    expect(loadRun(bad)).toBeNull();
    expect(() => clearRun(bad)).not.toThrow();
    expect(loadHall(bad)).toEqual([]);
  });
  it('keeps the newest 20 hall of fame entries', () => {
    const kv = memKV();
    for (let i = 1; i <= 25; i++) addHall(entry(i), kv);
    const h = loadHall(kv);
    expect(h).toHaveLength(20);
    expect(h[0]!.companyName).toBe('단25');
  });
});

describe('save validation depth', () => {
  it('rejects saves missing formation or pointing at a missing room', () => {
    const kv = memKV();
    const r = newRun(2, 'x');
    const { formation: _f, ...noFormation } = r;
    void _f;
    kv.setItem('projr.run.v2', JSON.stringify(noFormation));
    expect(loadRun(kv)).toBeNull();
    kv.setItem('projr.run.v2', JSON.stringify({ ...r, exploration: { rooms: {}, at: 'r9' } }));
    expect(loadRun(kv)).toBeNull();
  });
  it('ignores malformed hall entries', () => {
    const kv = memKV();
    kv.setItem('projr.hall.v1', JSON.stringify([null, 3, entry(1)]));
    expect(loadHall(kv)).toHaveLength(1);
  });
});
