import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput, type HeroInput } from '../../src/sim/world/worldSim';
import { partyUnits } from '../../src/sim/world/party';
import { heroUnit } from '../../src/sim/world/worldState';
import { alertGroup } from '../../src/sim/world/perception';
import { isAutoPick, SEARCH_TICKS } from '../../src/sim/world/autoLoot';
import { addItem } from '../../src/sim/extract/loadout';
import { xitem } from '../../src/data/extract';
import type { Container } from '../../src/sim/extract/region';
import { testRegion, crew, spawn } from './support/worldKit';

const SEC = 20;
const log = new WeakMap<WorldSim, { type: string; data?: Record<string, unknown> }[]>();
const go = (s: WorldSim, n: number, extra: Partial<HeroInput> = {}) => {
  const seen = log.get(s) ?? [];
  log.set(s, seen);
  for (let i = 0; i < n && !s.w.outcome; i++) { s.step({ ...idleInput(), ...extra }); seen.push(...(s.w.events as typeof seen)); }
};
const saw = (s: WorldSim, type: string, rare = false) => (log.get(s) ?? []).some((e) => e.type === type && (!rare || !!e.data?.rare));
const box = (kind: Container['kind'], x: number, tier = 1, extra?: string[]): Container => ({ id: `c_${kind}`, kind, pos: { x, y: 0 }, tier, extra });
const world = (containers: Container[] = [], spawns = [] as ReturnType<typeof spawn>[]) => WorldSim.party(testRegion(spawns, { start: { x: 0, y: 0 }, containers }), crew(3), [], null, 2);

describe('looting', () => {
  it('cheap things are picked up by walking past; gear is left for a decision', () => {
    expect(isAutoPick('x_coins')).toBe(true);
    expect(isAutoPick('x_bone')).toBe(true);
    expect(isAutoPick('x_sword_shield_2')).toBe(false);
    expect(isAutoPick('x_crown')).toBe(false);
    const s = world();
    s.w.piles.push({ id: 'p1', pos: { x: 4, y: 0 }, items: [{ id: 'x_coins', n: 2 }, { id: 'x_bone', n: 3 }, { id: 'x_sword_shield_2', n: 1 }] });
    go(s, SEC * 2, { move: { x: 1, y: 0 } });
    const bag = s.w.hero.loadout.bag.map((x) => x.id);
    expect(bag).toContain('x_coins');
    expect(bag).toContain('x_bone');
    expect(s.w.piles[0]!.items).toEqual([{ id: 'x_sword_shield_2', n: 1 }]);
    expect(saw(s, 'picked')).toBe(true);
  });

  it('a full pack stops auto pickup and nothing is lost', () => {
    const s = world();
    for (let i = 0; i < 18; i++) s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_lute').loadout;
    s.w.piles.push({ id: 'p1', pos: { x: 4, y: 0 }, items: [{ id: 'x_coins', n: 2 }] });
    go(s, SEC * 2, { move: { x: 1, y: 0 } });
    expect(s.w.piles[0]!.items).toEqual([{ id: 'x_coins', n: 2 }]);
  });

  it('a crate takes a second to search, a relic chest two', () => {
    expect(SEARCH_TICKS.crate).toBe(20);
    expect(SEARCH_TICKS.relic).toBe(40);
    const s = world([box('crate', 1.5)]);
    go(s, 1, { interact: true });
    expect(s.w.hero.channel?.total).toBe(20);
  });

  it('a searched chest goes straight into the pack without opening a window', () => {
    const s = world([box('crate', 1.5)]);
    go(s, 1, { interact: true });
    go(s, 25);
    expect(s.w.containers.c_crate!.opened).toBe(true);
    expect(s.w.containers.c_crate!.items).toEqual([]);
    expect(s.w.hero.loadout.bag.length).toBeGreaterThan(0);
    expect(saw(s, 'loot')).toBe(false);
    expect(saw(s, 'found')).toBe(true);
  });

  it('when the pack is full the leftovers stay and the choice window opens', () => {
    const s = world([box('crate', 1.5)]);
    for (let i = 0; i < 18; i++) s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_lute').loadout;
    go(s, 1, { interact: true });
    go(s, 25);
    expect(s.w.containers.c_crate!.items.length).toBeGreaterThan(0);
    expect(saw(s, 'loot')).toBe(true);
  });

  it('something dropped by hand is not picked straight back up', () => {
    const s = world();
    for (let i = 0; i < 18; i++) s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_lute').loadout;
    s.w.hero.loadout = { ...s.w.hero.loadout, bag: [...s.w.hero.loadout.bag.slice(0, 17), { id: 'x_coins', n: 1 }] };
    s.lootDrop('bag', 17);
    go(s, SEC);
    expect(s.w.hero.loadout.bag.some((x) => x.id === 'x_coins')).toBe(false);
    expect(s.w.piles.some((p) => p.items.some((x) => x.id === 'x_coins'))).toBe(true);
  });

  it('rare things are left in the chest for the player to decide on', () => {
    const s = world([box('vault', 1.5, 2)]);
    go(s, 1, { interact: true });
    go(s, 45);
    const rare = (id: string) => xitem(id).tier >= 3 || xitem(id).kind === 'relic';
    const left = s.w.containers.c_vault!.items;
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((x) => rare(x.id))).toBe(true);
    expect(s.w.hero.loadout.bag.some((x) => rare(x.id))).toBe(false);
    expect(saw(s, 'loot')).toBe(true);
  });

  it('a rare find is announced loudly', () => {
    const s = world([box('vault', 1.5, 2)]);
    go(s, 1, { interact: true });
    go(s, 45);
    expect(saw(s, 'found', true)).toBe(true);
  });

  it('enemies closing in break off the search; the chest stays shut', () => {
    const s = world([box('relic', 1.5, 3)], [spawn('a', 9, 0, 'g1', 'skeleton_minion')]);
    go(s, 1, { interact: true });
    alertGroup(s.w, 'g1');
    go(s, 10);
    expect(s.w.hero.channel?.kind).not.toBe('search');
    expect(s.w.containers.c_relic?.opened).toBeFalsy();
  });

  it('while one searches, the others watch outward', () => {
    const s = world([box('relic', 1.5, 3)]);
    go(s, SEC * 2);
    go(s, 1, { interact: true });
    go(s, 10);
    const h = heroUnit(s.w).pos;
    for (const u of partyUnits(s.w).slice(1)) {
      const out = Math.atan2(u.pos.y - h.y, u.pos.x - h.x);
      let off = Math.abs(out - u.facing) % (Math.PI * 2);
      if (off > Math.PI) off = Math.PI * 2 - off;
      expect(off).toBeLessThan(0.6);
    }
  });

  it('herbs are gathered just by walking by', () => {
    const s = world([box('herb', 4, 0)]);
    go(s, SEC * 2, { move: { x: 1, y: 0 } });
    expect(s.w.containers.c_herb?.opened).toBe(true);
  });
});
