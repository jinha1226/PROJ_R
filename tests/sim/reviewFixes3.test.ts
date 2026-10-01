import { describe, it, expect } from 'vitest';
import { newRoster } from '../../src/sim/roster/generate';
import { resolveBattle, type BattleReport } from '../../src/sim/roster/aftermath';
import type { Roster } from '../../src/sim/roster/types';

const report = (r: Roster, over: Partial<BattleReport> = {}): BattleReport => ({
  outcome: 'victory', stage: 1, events: [], enemies: {},
  units: r.mercs.map((m) => ({ id: m.id, alive: true, downed: false, minLifelineFrac: 1 })), ...over,
});
const ids = (r: Roster) => r.mercs.map((m) => m.id);

describe('plan 3 review fixes (aftermath)', () => {
  it('rescued survivors who nearly died can scar too', () => {
    let scars = 0;
    for (let seed = 0; seed < 30; seed++) {
      const r = newRoster(seed, 2);
      const out = resolveBattle(r, ids(r), report(r, { units: report(r).units.map((u) => (u.id === 'm1' ? { ...u, downed: false, minLifelineFrac: 0.15 } : u)) }));
      scars += out.scars.length;
    }
    expect(scars).toBeGreaterThan(3);
  });
  it('losing two friends in one battle grieves once', () => {
    let r = newRoster(3, 3);
    r = { ...r, relations: [
      { a: 'm1', b: 'm3', affinity: 50, rival: false, battlesTogether: 2, contests: 0 },
      { a: 'm2', b: 'm3', affinity: 50, rival: false, battlesTogether: 2, contests: 0 },
    ] };
    r = { ...r, mercs: r.mercs.map((m) => (m.id === 'm3' ? { ...m, traits: m.traits.filter((x) => x !== 'vengeful') } : m)) };
    const out = resolveBattle(r, ids(r), report(r, { outcome: 'defeat', units: report(r).units.map((u) => (u.id === 'm1' || u.id === 'm2' ? { ...u, alive: false } : u)) }));
    const m3 = out.roster.mercs.find((m) => m.id === 'm3')!;
    expect(m3.tempTraits.filter((x) => x.trait === 'vengeful')).toHaveLength(1);
  });
});
