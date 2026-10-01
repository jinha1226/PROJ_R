import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput, type HeroInput } from '../../src/sim/world/worldSim';
import { partyUnits, updateLeader } from '../../src/sim/world/party';
import { heroUnit, unit } from '../../src/sim/world/worldState';
import { alertGroup } from '../../src/sim/world/perception';
import { alertOnHit } from '../../src/sim/world/heroControl';
import { downUnit } from '../../src/sim/battle/damage';
import { newCompany, settleCompany, canDeploy } from '../../src/sim/extract/company';
import { testRegion, spawn, crew } from './support/worldKit';

const SEC = 20;
const go = (s: WorldSim, n: number, extra: Partial<HeroInput> = {}) => { for (let i = 0; i < n && !s.w.outcome; i++) s.step({ ...idleInput(), ...extra }); };

describe('final review fixes (Plan 7a)', () => {
  it('a member far away who takes the lead is not left "leashed" and idle', () => {
    const s = WorldSim.party(testRegion([spawn('a', 4, 0, 'g1', 'skeleton_warrior')], { start: { x: 0, y: 0 } }), crew(3), [], null, 3);
    alertGroup(s.w, 'g1');
    go(s, SEC);
    const m1 = unit(s.w, 'm1');
    m1.pos = { x: -14, y: 0 };
    go(s, 2);
    downUnit(s.w.b, heroUnit(s.w), null);
    go(s, 2);
    expect(s.w.heroId).toBe('m1');
    expect(s.w.party.follow.m1?.leashed).toBeFalsy();
  });

  it('a hit from any member alerts an unaware group', () => {
    const s = WorldSim.party(testRegion([spawn('a', 8, 0, 'g1', 'skeleton_minion')], { start: { x: 0, y: 0 } }), crew(3), [], null, 3);
    s.w.b.events = [{ tick: 0, type: 'damage', src: 'm2', dst: 'a', amount: 3 }];
    alertOnHit(s.w);
    expect(s.w.groups.g1!.alerted).toBe(true);
  });

  it('a focus target that falls asleep far away is dropped and combat ends', () => {
    const s = WorldSim.party(testRegion([spawn('a', 12, 0, 'g1', 'skeleton_minion')], { start: { x: 0, y: 0 } }), crew(3), [], null, 3);
    heroUnit(s.w).facing = 0;
    go(s, 1);
    go(s, 1, { focus: true });
    expect(s.w.b.focusTargetId).toBe('a');
    partyUnits(s.w).forEach((u, i) => { u.pos = { x: -40 - i, y: 0 }; });
    s.w.party.trail = [];
    s.w.groups.g1!.alerted = false;
    s.w.ai.a!.mode = 'idle';
    go(s, SEC * 5);
    expect(s.w.b.focusTargetId).toBeUndefined();
    expect(s.w.party.mode).toBe('explore');
  });

  it('holding still in an extraction zone under fire keeps the leader in the zone', () => {
    const s = WorldSim.party(testRegion([spawn('a', 62, 0, 'g1', 'bandit_archer'), spawn('b', 62, 3, 'g1', 'bandit_archer')], { start: { x: 50, y: 0 } }), crew(3), [], null, 3);
    alertGroup(s.w, 'g1');
    go(s, SEC * 3);
    const ex = s.w.region.extracts[0]!.pos;
    expect(Math.hypot(heroUnit(s.w).pos.x - ex.x, heroUnit(s.w).pos.y - ex.y)).toBeLessThan(4);
  });

  it('being carried out keeps a mercenary out for two sorties', () => {
    let c = newCompany(5);
    const [a, b] = c.mercs.map((m) => m.id) as [string, string];
    c = settleCompany(c, { outcome: 'extracted', pack: [], pouch: null, members: [{ id: a, state: 'home', xp: 0, gear: c.gear[a]! }, { id: b, state: 'carried', xp: 0, gear: c.gear[b]! }] }).company;
    const after1 = settleCompany(c, { outcome: 'extracted', pack: [], pouch: null, members: [{ id: a, state: 'home', xp: 0, gear: c.gear[a]! }] }).company;
    expect(canDeploy(after1.mercs.find((m) => m.id === b)!)).toBe(false);
    const after2 = settleCompany(after1, { outcome: 'extracted', pack: [], pouch: null, members: [{ id: a, state: 'home', xp: 0, gear: after1.gear[a]! }] }).company;
    expect(canDeploy(after2.mercs.find((m) => m.id === b)!)).toBe(true);
  });

  it('a hurt mercenary who keeps deploying still recovers a step each sortie', () => {
    let c = newCompany(5);
    const a = c.mercs[0]!.id;
    c = { ...c, mercs: c.mercs.map((m) => (m.id === a ? { ...m, injury: 1 } : m)) };
    const r = settleCompany(c, { outcome: 'extracted', pack: [], pouch: null, members: [{ id: a, state: 'home', xp: 0, gear: c.gear[a]! }] }).company;
    expect(r.mercs.find((m) => m.id === a)!.injury).toBe(0);
  });

  it('a new leader is the one enemies treat as the leader', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), crew(3), [], null, 3);
    downUnit(s.w.b, heroUnit(s.w), null);
    updateLeader(s.w);
    expect(unit(s.w, 'm1').setup.isLeader).toBe(true);
    expect(unit(s.w, 'm0').setup.isLeader).toBeFalsy();
    expect(partyUnits(s.w).filter((u) => u.setup.isLeader).length).toBe(1);
  });
});
