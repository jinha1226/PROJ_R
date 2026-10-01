import { describe, it, expect } from 'vitest';
import { WorldSim } from '../../src/sim/world/worldSim';
import { partyUnits } from '../../src/sim/world/party';
import { addItem } from '../../src/sim/extract/loadout';
import { hudState } from '../../src/ui/extract/hudState';
import { testRegion, crew } from '../sim/support/worldKit';

const world = () => WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), crew(3), [], null, 2);

describe('hud state', () => {
  it('lists the party leader first with hp, downed and fallen members', () => {
    const s = world();
    const [, b, c] = partyUnits(s.w);
    b!.downed = true;
    c!.alive = false;
    const h = hudState(s.w, null);
    expect(h.party.map((p) => p.id)).toEqual(['m0', 'm1', 'm2']);
    expect(h.party[0]).toMatchObject({ lead: true, hp: 1, down: false, dead: false });
    expect(h.party[1]).toMatchObject({ lead: false, down: true, hp: 0 });
    expect(h.party[2]).toMatchObject({ dead: true, hp: 0 });
    expect(h.party[0]!.name).toBe(s.w.party.mercs.m0!.name);
  });

  it('reports carried value, slots and weight', () => {
    const s = world();
    s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_coins', 3).loadout;
    const h = hudState(s.w, null);
    expect(h.value).toBeGreaterThan(0);
    expect(h.slots[0]).toBe(1);
    expect(h.slots[1]).toBeGreaterThanOrEqual(18);
    expect(h.weight[0]).toBeGreaterThan(0);
    expect(h.weight[1]).toBeGreaterThan(h.weight[0]);
  });

  it('formats the sortie clock as mm:ss with the phase', () => {
    const s = world();
    s.w.b.tick = 20 * 75;
    const h = hudState(s.w, null);
    expect(h.clock).toBe('01:15');
    expect(h.phase).toBe('day');
  });

  it('labels the channel, including waiting for the whole party at an extraction point', () => {
    const s = world();
    s.w.hero.channel = { kind: 'search', ticks: 5, total: 20 };
    expect(hudState(s.w, null).channel).toEqual({ label: '뒤지는 중', frac: 0.25 });
    s.w.hero.channel = { kind: 'extract', ticks: 0, total: 100, waiting: true };
    expect(hudState(s.w, null).channel?.label).toBe('모두 탈출 지점 안으로 들어와야 한다');
    s.w.hero.channel = undefined;
    s.w.hero.drink = { ticks: 10, total: 20, item: 'x_potion_1' };
    expect(hudState(s.w, null).channel).toEqual({ label: '마시는 중', frac: 0.5 });
  });

  it('shows the prompt only when nothing is being channelled', () => {
    const s = world();
    expect(hudState(s.w, { kind: 'search', id: 'c1' }).prompt).toBe('뒤지기');
    s.w.hero.channel = { kind: 'search', ticks: 1, total: 20 };
    expect(hudState(s.w, { kind: 'search', id: 'c1' }).prompt).toBeUndefined();
    expect(hudState(s.w, null).prompt).toBeUndefined();
  });

  it('focus works outside a fight (an ambush); retreat only in one', () => {
    const s = world();
    expect(hudState(s.w, null).orders).toEqual({ focus: true, retreat: false, regroup: true });
    s.w.party.mode = 'combat';
    expect(hudState(s.w, null).combat).toBe(true);
    expect(hudState(s.w, null).orders.retreat).toBe(true);
  });

  it('carries what the minimap draws: places, exits, party and the leader', () => {
    const s = world();
    const h = hudState(s.w, null);
    expect(h.minimap.extracts).toEqual([{ x: 50, y: 0, closed: false }]);
    expect(h.minimap.party).toHaveLength(3);
    expect(h.minimap.hero).toEqual({ x: 0, y: 0 });
  });
});
