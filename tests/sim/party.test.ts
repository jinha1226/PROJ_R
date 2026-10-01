import { describe, it, expect } from 'vitest';
import { createPartyWorld, partyUnits, updateLeader, refreshParty } from '../../src/sim/world/party';
import { heroUnit } from '../../src/sim/world/worldState';
import { updateActivation } from '../../src/sim/world/activation';
import { updatePerception } from '../../src/sim/world/perception';
import { addItem } from '../../src/sim/extract/loadout';
import { NavGrid } from '../../src/sim/world/nav';
import { testRegion, spawn, crew } from './support/worldKit';

describe('party world', () => {
  it('spawns up to five members on free ground around the start; the first is the leader', () => {
    const w = createPartyWorld(testRegion([]), crew(5), [], null, 1);
    const us = partyUnits(w);
    expect(us.map((u) => u.id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(w.heroId).toBe('m0');
    const nav = new NavGrid(w.region.bounds, w.region.obstacles);
    for (const u of us) {
      expect(nav.walkable(u.pos)).toBe(true);
      expect(Math.hypot(u.pos.x - w.region.start.x, u.pos.y - w.region.start.y)).toBeLessThan(5);
    }
    expect(w.hero.loadout.slots).toBe(30);
  });

  it('the next standing member takes over when the leader goes down', () => {
    const w = createPartyWorld(testRegion([]), crew(3), [], null, 1);
    heroUnit(w).downed = true;
    updateLeader(w);
    expect(w.heroId).toBe('m1');
    expect(w.events.filter((e) => e.type === 'leader').length).toBe(1);
    updateLeader(w);
    expect(w.events.filter((e) => e.type === 'leader').length).toBe(1);
  });

  it('a heavy pack slows every member', () => {
    const w = createPartyWorld(testRegion([]), crew(2), [], null, 1);
    const before = partyUnits(w).map((u) => u.setup.stats.moveSpeed);
    for (const id of ['x_idol', 'x_reliquary', 'x_grail', 'x_crown']) w.hero.loadout = addItem(w.hero.loadout, id).loadout;
    refreshParty(w);
    partyUnits(w).forEach((u, i) => expect(u.setup.stats.moveSpeed).toBeLessThan(before[i]!));
  });

  it('enemies notice any member, not only the leader', () => {
    const w = createPartyWorld(testRegion([spawn('a', 30, 0)]), crew(2), [], null, 1);
    partyUnits(w)[1]!.pos = { x: 24, y: 0 };
    w.b.units.find((u) => u.id === 'a')!.facing = Math.PI;
    updateActivation(w);
    updatePerception(w);
    expect(w.groups.g1!.alerted).toBe(true);
  });
});
