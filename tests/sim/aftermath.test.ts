import { describe, it, expect } from 'vitest';
import { newRoster } from '../../src/sim/roster/generate';
import { resolveBattle, type BattleReport } from '../../src/sim/roster/aftermath';
import type { BattleEvent } from '../../src/sim/battle/types';
import type { Roster } from '../../src/sim/roster/types';

const ev = (e: Omit<BattleEvent, 'tick'> & { tick?: number }): BattleEvent => ({ tick: 1, ...e });
const base = (): Roster => newRoster(8, 3);
const report = (r: Roster, over: Partial<BattleReport> = {}): BattleReport => ({
  outcome: 'victory', stage: 1, events: [],
  units: r.mercs.map((m) => ({ id: m.id, alive: true, downed: false, minLifelineFrac: 1 })),
  enemies: { e0: { defId: 'bandit_cutthroat' }, e1: { defId: 'bandit_chief', elite: true }, e2: { defId: 'ashen_knight', boss: true } },
  ...over,
});
const ids = (r: Roster) => r.mercs.map((m) => m.id);

describe('battle aftermath', () => {
  it('awards xp: 30 + 6/kill + 20 victory, halved on defeat or retreat', () => {
    const r = base();
    const win = resolveBattle(r, ids(r), report(r, { events: [ev({ type: 'died', src: 'm1', dst: 'e0' })] }));
    expect(win.xp.m1).toBe(56);
    expect(win.xp.m2).toBe(50);
    const lose = resolveBattle(r, ids(r), report(r, { outcome: 'retreat' }));
    expect(lose.xp.m2).toBe(15);
  });
  it('injures those left downed and heals injuries over time', () => {
    let r = base();
    const a = resolveBattle(r, ids(r), report(r, { units: report(r).units.map((u) => (u.id === 'm1' ? { ...u, downed: true, minLifelineFrac: 0.9 } : u)) }));
    const m1 = a.roster.mercs.find((m) => m.id === 'm1')!;
    expect(m1.injury).toBeGreaterThanOrEqual(2);
    expect(a.injuries).toContain('m1');
    r = a.roster;
    const b = resolveBattle(r, ['m0', 'm2'], report(r));
    expect(b.roster.mercs.find((m) => m.id === 'm1')!.injury).toBe(m1.injury - 1);
  });
  it('the dead go to the memorial, their gear to the inventory, and friends grieve', () => {
    let r = base();
    r = { ...r, relations: [{ a: 'm1', b: 'm2', affinity: 50, rival: false, battlesTogether: 3, contests: 0 }] };
    const out = resolveBattle(r, ids(r), report(r, {
      outcome: 'defeat', events: [ev({ type: 'died', src: 'e0', dst: 'm1' })],
      units: report(r).units.map((u) => (u.id === 'm1' ? { ...u, alive: false } : u)),
    }));
    expect(out.deaths).toEqual(['m1']);
    expect(out.roster.mercs.some((m) => m.id === 'm1')).toBe(false);
    expect(out.roster.memorial[0]!.id).toBe('m1');
    expect(out.roster.inventory).toContain(r.mercs[1]!.gear.weapon);
    const m2 = out.roster.mercs.find((m) => m.id === 'm2')!;
    expect(m2.tempTraits.some((t) => t.trait === 'vengeful') || m2.traits.includes('vengeful')).toBe(true);
    expect(m2.chronicle.some((c) => c.key === 'friendDied')).toBe(true);
    expect(out.roster.relations.some((x) => x.a === 'm1' || x.b === 'm1')).toBe(false);
  });
  it('titles, chronicle, and the hidden trait reveal', () => {
    const r = base();
    const events = [
      ev({ type: 'died', src: 'm1', dst: 'e2' }),
      ev({ type: 'died', src: 'm2', dst: 'e1' }),
      ev({ type: 'rescued', src: 'm2', dst: 'm3' }),
    ];
    const out = resolveBattle(r, ids(r), report(r, { events }));
    const m1 = out.roster.mercs.find((m) => m.id === 'm1')!;
    expect(m1.title).toBe('giantSlayer');
    expect(m1.chronicle.map((c) => c.key)).toEqual(expect.arrayContaining(['firstKill', 'bossKill', 'title']));
    expect(m1.revealed).toHaveLength(2);
    const m3 = out.roster.mercs.find((m) => m.id === 'm3')!;
    expect(m3.chronicle.some((c) => c.key === 'downedRescued' && c.vars.by === 'm2')).toBe(true);
  });
  it('scars can follow a near-death survival', () => {
    let scars = 0;
    for (let seed = 0; seed < 30; seed++) {
      const r = { ...newRoster(seed, 2) };
      const out = resolveBattle(r, ids(r), report(r, { units: report(r).units.map((u) => (u.id === 'm1' ? { ...u, downed: true, minLifelineFrac: 0.2 } : u)) }));
      scars += out.scars.length;
      const safe = resolveBattle(r, ids(r), report(r, { units: report(r).units.map((u) => (u.id === 'm1' ? { ...u, downed: true, minLifelineFrac: 0.5 } : u)) }));
      expect(safe.scars).toEqual([]);
    }
    expect(scars).toBeGreaterThan(3);
    expect(scars).toBeLessThan(20);
  });
  it('loot is deterministic and only on victory', () => {
    const r = base();
    const a = resolveBattle(r, ids(r), report(r, { events: [ev({ type: 'died', src: 'm1', dst: 'e1' })] }));
    expect(a.loot.length).toBe(2);
    expect(resolveBattle(r, ids(r), report(r, { events: [ev({ type: 'died', src: 'm1', dst: 'e1' })] })).loot).toEqual(a.loot);
    expect(resolveBattle(r, ids(r), report(r, { outcome: 'defeat' })).loot).toEqual([]);
    expect(a.roster.inventory).toEqual(expect.arrayContaining(a.loot));
  });
  it('does not mutate the input roster', () => {
    const r = base();
    const snapshot = JSON.stringify(r);
    resolveBattle(r, ids(r), report(r, { events: [ev({ type: 'died', src: 'm1', dst: 'e0' })] }));
    expect(JSON.stringify(r)).toBe(snapshot);
  });
});

describe('report from a real battle', () => {
  it('captures outcome, ally states, and enemy flags', async () => {
    const { Battle } = await import('../../src/sim/battle/battle');
    const { setupFromPresets } = await import('../../src/sim/battle/setup');
    const { reportFromBattle } = await import('../../src/sim/roster/aftermath');
    const b = new Battle(setupFromPresets(2, 'standard', 'boss'));
    const events: BattleEvent[] = [];
    while (!b.outcome) events.push(...b.step().events);
    const rep = reportFromBattle(b.state, events, 12);
    expect(rep.outcome).toBe(b.outcome);
    expect(rep.units).toHaveLength(5);
    expect(Object.values(rep.enemies).some((e) => e.boss)).toBe(true);
    expect(rep.units.some((u) => u.minLifelineFrac < 1)).toBe(true);
  });
});
