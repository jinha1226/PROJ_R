import { describe, it, expect } from 'vitest';
import { WorldSim, idleInput } from '../../src/sim/world/worldSim';
import { partyUnits } from '../../src/sim/world/party';
import { heroUnit, unit } from '../../src/sim/world/worldState';
import { killUnit, downUnit } from '../../src/sim/battle/damage';
import { emptyLoadout, addItem, bagSlots } from '../../src/sim/extract/loadout';
import { testRegion, crew } from './support/worldKit';

const SEC = 20;
const go = (s: WorldSim, n: number) => { for (let i = 0; i < n && !s.w.outcome; i++) s.step(idleInput()); };
const geared = (n: number) => crew(n).map((m, i) => ({ ...m, gear: { ...emptyLoadout(), equipped: { bag: 'x_bag_1', head: i === 1 ? 'x_head_2' : undefined } } }));
const atExit = (n = 3) => WorldSim.party(testRegion([], { start: { x: 50, y: 0 } }), geared(n), [], null, 1);

describe('party losses and extraction', () => {
  it('a fallen member leaves a body with their gear; the pack shrinks and spills, nothing vanishes', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), geared(3), [], null, 1);
    for (let i = 0; i < 6; i++) s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_lute').loadout;
    for (let i = 0; i < 20; i++) s.w.hero.loadout = addItem(s.w.hero.loadout, 'x_spoon', 5).loadout;
    const count = () => s.w.hero.loadout.bag.reduce((a, x) => a + x.n, 0) + s.w.piles.reduce((a, p) => a + p.items.filter((x) => x.id !== 'x_head_2' && x.id !== 'x_bag_1').reduce((b, x) => b + x.n, 0), 0);
    const before = count();
    killUnit(s.w.b, unit(s.w, 'm1'), null);
    go(s, 1);
    expect(s.w.party.dead).toEqual(['m1']);
    expect(bagSlots(s.w.hero.loadout)).toBe(20);
    const body = s.w.piles.find((p) => p.items.some((x) => x.id === 'x_head_2'))!;
    expect(body.items.map((x) => x.id).sort()).toEqual(['x_bag_1', 'x_head_2']);
    expect(count()).toBe(before);
  });

  it('the body can be searched to take the gear back', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), geared(3), [], null, 1);
    killUnit(s.w.b, unit(s.w, 'm1'), null);
    go(s, 1);
    const body = s.w.piles.find((p) => p.items.some((x) => x.id === 'x_head_2'))!;
    heroUnit(s.w).pos = { ...body.pos };
    const i = body.items.findIndex((x) => x.id === 'x_head_2');
    expect(s.lootTake(body.id, i)).toBe(true);
    expect(s.w.hero.loadout.bag.some((x) => x.id === 'x_head_2')).toBe(true);
  });

  it('getting hit sets the extraction gauge back; a downed member slows it', () => {
    const s = atExit();
    go(s, SEC * 4);
    const ch = s.w.hero.channel!;
    expect(ch.kind).toBe('extract');
    const t0 = ch.ticks;
    partyUnits(s.w)[2]!.hp -= 10;
    go(s, 1);
    expect(s.w.hero.channel!.ticks).toBeLessThan(t0 - 30);
    const slow = atExit();
    downUnit(slow.w.b, partyUnits(slow.w)[2]!, null);
    go(slow, SEC * 4);
    const fast = atExit();
    go(fast, SEC * 4);
    expect(slow.w.hero.channel!.ticks).toBeLessThan(fast.w.hero.channel!.ticks * 0.8);
  });

  it('only those inside the zone come home; downed inside are carried, anyone outside is lost', () => {
    const s = atExit(4);
    const [, b, c, d] = partyUnits(s.w);
    downUnit(s.w.b, b!, null);
    c!.pos = { x: 30, y: 0 };
    downUnit(s.w.b, c!, null);
    killUnit(s.w.b, d!, null);
    for (let i = 0; i < SEC * 15 && !s.w.outcome; i++) s.step(idleInput());
    expect(s.w.outcome).toBe('extracted');
    const end = s.end();
    expect(end.outcome).toBe('extracted');
    expect(Object.fromEntries(end.members.map((m) => [m.id, m.state]))).toEqual({ m0: 'home', m1: 'carried', m2: 'dead', m3: 'dead' });
  });

  it('the recall scroll brings everyone home, downed members carried', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), geared(2), [], null, 1);
    s.w.hero.loadout = { ...s.w.hero.loadout, quick: [{ id: 'x_recall', n: 1 }] };
    downUnit(s.w.b, partyUnits(s.w)[1]!, null);
    s.step({ ...idleInput(), quick: 0 });
    for (let i = 0; i < SEC * 30 && !s.w.outcome; i++) s.step(idleInput());
    expect(s.w.outcome).toBe('extracted');
    expect(s.end().members.map((m) => m.state)).toEqual(['home', 'carried']);
  });

  it('a party wipe fails the sortie and every member is lost', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), geared(2), [], null, 1);
    for (const u of partyUnits(s.w)) downUnit(s.w.b, u, null);
    go(s, 1);
    expect(s.w.outcome).toBe('failed');
    expect(s.end().members.every((m) => m.state === 'dead')).toBe(true);
  });
  it('consumables are used straight from the shared pack', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 0, y: 0 } }), geared(2), [{ id: 'x_potion_m', n: 2 }], null, 1);
    const h = heroUnit(s.w);
    h.hp = h.maxHp / 3;
    go(s, 1);
    s.useItem(0);
    go(s, SEC);
    expect(h.hp).toBeGreaterThan(h.maxHp / 2);
    expect(s.w.hero.loadout.bag).toEqual([{ id: 'x_potion_m', n: 1 }]);
  });
  it('the hold waits for every standing member to be inside the zone', () => {
    const s = atExit(3);
    const straggler = partyUnits(s.w)[2]!;
    for (let i = 0; i < SEC * 3; i++) { straggler.pos = { x: 40, y: 0 }; s.step(idleInput()); }
    expect(s.w.hero.channel?.ticks ?? 0).toBe(0);
    go(s, SEC * 12);
    expect(s.w.outcome).toBe('extracted');
    expect(s.end().members.every((m) => m.state === 'home')).toBe(true);
  });
  it('a full party of five bunches up inside the zone and gets out', () => {
    const s = WorldSim.party(testRegion([], { start: { x: 32, y: 0 } }), geared(5), [], null, 1);
    for (let i = 0; i < SEC * 30 && !s.w.outcome; i++) {
      const h = heroUnit(s.w).pos;
      const dx = 50 - h.x;
      const dy = 0 - h.y;
      const l = Math.hypot(dx, dy);
      s.step({ ...idleInput(), move: l > 0.3 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 } });
    }
    expect(s.w.outcome).toBe('extracted');
    expect(s.end().members.every((m) => m.state === 'home')).toBe(true);
  });
});
