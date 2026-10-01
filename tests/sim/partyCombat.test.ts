import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput, type HeroInput } from '../../src/sim/world/worldSim';
import { partyUnits } from '../../src/sim/world/party';
import { heroUnit, unit } from '../../src/sim/world/worldState';
import { alertGroup } from '../../src/sim/world/perception';
import { testRegion, spawn, crew } from './support/worldKit';

const SEC = 20;
const go = (s: WorldSim, n: number, extra: Partial<HeroInput> = {}) => { for (let i = 0; i < n && !s.w.outcome; i++) s.step({ ...idleInput(), ...extra }); };
const party = (spawns = [spawn('a', 6, 0, 'g1', 'skeleton_minion'), spawn('b', 7, 2, 'g1', 'skeleton_minion')]) =>
  WorldSim.party(testRegion(spawns, { start: { x: 0, y: 0 } }), crew(4), [], null, 3);
const centre = (s: WorldSim) => { const us = partyUnits(s.w); return { x: us.reduce((a, u) => a + u.pos.x, 0) / us.length, y: us.reduce((a, u) => a + u.pos.y, 0) / us.length }; };

describe('party auto combat', () => {
  it('everyone fights on their own once enemies are alert nearby', () => {
    const s = party();
    alertGroup(s.w, 'g1');
    go(s, SEC);
    expect(s.w.party.mode).toBe('combat');
    for (const u of partyUnits(s.w)) expect(u.intent, u.id).not.toBeNull();
  });

  it('after the fight the party settles back into exploring around the leader', () => {
    const s = party();
    alertGroup(s.w, 'g1');
    go(s, SEC * 25);
    expect(s.w.b.units.filter((u) => u.team === 'enemy' && u.alive).length).toBe(0);
    go(s, SEC * 4);
    expect(s.w.party.mode).toBe('explore');
    const h = heroUnit(s.w).pos;
    for (const u of partyUnits(s.w)) expect(Math.hypot(u.pos.x - h.x, u.pos.y - h.y)).toBeLessThan(5);
  });

  it('a brief lull does not flip the party out of combat', () => {
    const s = party();
    alertGroup(s.w, 'g1');
    go(s, SEC);
    for (const id of ['a', 'b']) unit(s.w, id).dormant = true;
    s.w.ai.a!.mode = 'idle'; s.w.ai.b!.mode = 'idle';
    go(s, SEC);
    expect(s.w.party.mode).toBe('combat');
  });

  it('focus fire marks the enemy in front, and the archers switch to it', () => {
    const s = party([spawn('near', 3, -6, 'g1', 'skeleton_warrior'), spawn('front', 9, 0, 'g1', 'skeleton_minion')]);
    heroUnit(s.w).facing = 0;
    alertGroup(s.w, 'g1');
    go(s, 2);
    heroUnit(s.w).facing = 0; // the player turns the leader toward the one they mean
    go(s, 1, { focus: true });
    expect(s.w.b.focusTargetId).toBe('front');
    go(s, SEC * 2); // they finish the shot in hand, then switch
    expect(unit(s.w, 'm3').intent?.targetId).toBe('front');
  });

  it('retreat pulls the whole party away from the enemy for a few seconds', () => {
    const s = party();
    alertGroup(s.w, 'g1');
    go(s, SEC);
    const foe = unit(s.w, 'a').pos;
    const before = Math.hypot(centre(s).x - foe.x, centre(s).y - foe.y);
    go(s, 1, { retreat: true });
    go(s, SEC * 2);
    const after = Math.hypot(centre(s).x - unit(s.w, 'a').pos.x, centre(s).y - unit(s.w, 'a').pos.y);
    expect(after).toBeGreaterThan(before);
  });

  it('regroup draws scattered members back to the leader', () => {
    const s = party([]);
    partyUnits(s.w).slice(1).forEach((u, i) => { u.pos = { x: -10 - i * 3, y: 8 }; });
    const spread = () => { const h = heroUnit(s.w).pos; return partyUnits(s.w).reduce((a, u) => a + Math.hypot(u.pos.x - h.x, u.pos.y - h.y), 0); };
    const before = spread();
    go(s, 1, { regroup: true });
    go(s, SEC * 2);
    expect(spread()).toBeLessThan(before * 0.6);
  });
  it('a member who can no longer be rescued does not hold the party in combat forever', () => {
    const s = party([]);
    const down = partyUnits(s.w)[2]!;
    down.downed = true;
    down.hp = 0;
    down.rescueUsed = true;
    go(s, SEC * 4);
    expect(s.w.party.mode).toBe('explore');
  });
  it('members break off a fight to stay with a leader who moves away', () => {
    const s = party([spawn('a', -3, 0, 'g1', 'skeleton_warrior'), spawn('b', -3, 2, 'g1', 'skeleton_warrior'), spawn('c', -3, -2, 'g1', 'skeleton_warrior')]);
    alertGroup(s.w, 'g1');
    go(s, SEC);
    let worst = 0;
    for (let i = 0; i < SEC * 16; i++) {
      s.step({ ...idleInput(), move: { x: 1, y: 0 } });
      const h = heroUnit(s.w).pos;
      if (i > SEC * 4) for (const u of partyUnits(s.w)) if (!u.downed) worst = Math.max(worst, Math.hypot(u.pos.x - h.x, u.pos.y - h.y));
    }
    expect(worst).toBeLessThan(16);
  });
});
