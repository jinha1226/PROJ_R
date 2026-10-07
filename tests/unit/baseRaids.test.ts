import { describe, expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { upgradeDrill } from '../../src/sim/base/drill';
import { autoDefend, defencePower, onRaidReturn, raidSize, startRaid } from '../../src/sim/base/raids';
import { place } from '../../src/sim/base/buildings';
import { raidTurn } from '../../src/sim/base/raidAi';
import { departSurface } from '../../src/sim/base/trips';
import { takeParty } from '../../src/sim/roam/carry';
import { alive, entOf } from '../../src/sim/party/partyCore';
import { dist, type GEvent } from '../../src/sim/grid/types';
const setup = () => { const p = newSurface(42); p.ore = 200; p.crystal = 20; return p; };
describe('raids', () => {
  it('arms at first upgrade, warns on first return, raids on second and every second after', () => {
    const p = setup(); upgradeDrill(p);
    expect(p.raidClock).toBe(0);
    expect(onRaidReturn(p)).toMatchObject([{ text: 'raidSoon', amount: raidSize(p) }]);
    // the raid night waits for the player: ready, sides known, nobody out there yet
    expect(onRaidReturn(p)).toMatchObject([{ text: 'raidReady', amount: raidSize(p) }]);
    expect(p.raid).toBeNull(); expect(p.raidReady?.size).toBe(raidSize(p));
    expect(p.units.some(u => u.side === 'foe')).toBe(false);
    startRaid(p); expect(p.raid?.size).toBe(raidSize(p)); expect(p.raidReady).toBeNull();
    for (const u of p.units.filter(u => u.group === p.raid!.group)) entOf(p, u.id)!.alive = false;
    expect(worldTick(p, .1).some(e => e.text === 'raidWon')).toBe(true);
    expect(p.raidsDone).toBe(1);
    expect(onRaidReturn(p).some(e => e.text === 'raidSoon')).toBe(true);
    onRaidReturn(p); expect(p.raidReady).not.toBeNull();
  });
  it('arms on fourth completed trip without an upgrade', () => {
    const p = setup();
    for (let i = 0; i < 4; i++) expect(onRaidReturn(p)).toEqual([]);
    expect(p.trips).toBe(4); expect(p.raidClock).toBe(0);
    expect(onRaidReturn(p).some(e => e.text === 'raidSoon')).toBe(true);
    onRaidReturn(p); expect(p.raidReady).not.toBeNull();
  });
  it('a ready raid keeps the party home and comes in from the sides it showed', () => {
    const p = setup(); upgradeDrill(p); onRaidReturn(p); onRaidReturn(p);
    const sides = p.raidReady!.sides;
    expect(departSurface(p, 1, takeParty(p))).toBeNull();
    startRaid(p);
    const m = p.s.map, edgeOf = (c: { x: number; y: number }) => c.x === 0 ? 0 : c.x === m.w - 1 ? 1 : c.y === 0 ? 2 : 3;
    const spawned = p.units.filter(u => u.group === p.raid!.group).map(u => edgeOf(entOf(p, u.id)!.pos));
    expect(spawned.every(e => sides.includes(e))).toBe(true);
  });
  it('spawns awake raiders on connected map edges and advances toward the pod', () => {
    const p = setup(); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group)!;
    const e = entOf(p, u.id)!;
    expect(e.pos.x === 0 || e.pos.y === 0 || e.pos.x === p.s.map.w - 1 || e.pos.y === p.s.map.h - 1).toBe(true);
    expect(u.asleep).toBe(false); const before = dist(e.pos, p.base);
    worldTick(p, 3); expect(dist(e.pos, p.base)).toBeLessThan(before); expect(u.asleep).toBe(false);
  });
  it('attacks and breaks a blocking wall, and gates block raiders too', () => {
    for (const kind of ['wall', 'gate'] as const) {
      const p = setup(); place(p, kind, { x: 48, y: 46 }); startRaid(p);
      const u = p.units.find(u => u.group === p.raid!.group)!; entOf(p, u.id)!.pos = { x: 48, y: 45 };
      // Only way to the pod's north side is through this defence.
      p.s.map.tiles.fill('wall');
      for (const y of [45, 47]) p.s.map.tiles[y * 96 + 48] = 'floor';
      if (kind === 'gate') p.s.map.tiles[46 * 96 + 48] = 'floor';
      const ev: GEvent[] = [];
      for (let t = 0; t < 30 && p.buildings.length; t++) raidTurn(p, u, t, ev);
      expect(ev.some(e => e.type === 'hit' && e.dst?.startsWith('building'))).toBe(true);
      expect(p.buildings).toHaveLength(0);
      expect(p.s.map.tiles[46 * 96 + 48]).toBe('floor');
    }
  });
  it('cannot cut diagonally through the corners of breakable defences', () => {
    const p = setup(); place(p, 'wall', { x: 49, y: 46 }); place(p, 'wall', { x: 48, y: 45 }); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group)!; const e = entOf(p, u.id)!;
    e.pos = { x: 49, y: 45 }; p.s.map.tiles.fill('wall');
    for (const c of [{ x: 49, y: 45 }, { x: 48, y: 46 }, { x: 48, y: 47 }]) p.s.map.tiles[c.y * 96 + c.x] = 'floor';
    const ev: GEvent[] = []; raidTurn(p, u, 0, ev);
    expect(e.pos).toEqual({ x: 49, y: 45 });
    expect(ev.some(e => e.type === 'hit' && e.dst?.startsWith('building'))).toBe(true);
  });
  it('every clone down ends the raid lost without a wiped event (spec 2026-10-08 §5)', () => {
    const p = setup(); startRaid(p); p.s.hero.alive = false;
    const ev = worldTick(p, 1);
    expect(p.raid).toBeNull(); expect(p.over).toBe(false);
    expect(ev.some(e => e.text === 'wiped')).toBe(false); expect(ev.some(e => e.text === 'raidLost')).toBe(true);
  });
  it('towers shoot the nearest raider and use 1.5-turn cooldowns', () => {
    const p = setup(); place(p, 'watchtower', { x: 50, y: 45 }); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group)!; const e = entOf(p, u.id)!;
    e.pos = { x: 51, y: 45 }; u.nextAt = 100;
    // the clone (now with a pistol) holds its fire so only the tower's shots count
    for (const h of p.units) if (h.side === 'hero') h.nextAt = 100;
    const hp = e.hp; const ev = worldTick(p, .1);
    expect(ev.some(e => e.type === 'shoot' && e.src === p.buildings[0]!.id)).toBe(true);
    expect(hp - e.hp).toBeGreaterThanOrEqual(6); expect(hp - e.hp).toBeLessThanOrEqual(9);
    const after = e.hp; worldTick(p, 1); expect(e.hp).toBe(after);
    worldTick(p, .5); expect(e.hp).toBeLessThan(after);
  });
  it('pod loss takes exactly floor(30%) materials and 1–2 buildings without refunds', () => {
    const p = setup(); for (let x = 44; x < 47; x++) place(p, 'wall', { x, y: 44 });
    p.ore = 101; p.crystal = 19; startRaid(p); p.podHp = 0;
    expect(worldTick(p, .1).some(e => e.type === 'dead' && e.text === 'raidLost')).toBe(true);
    expect([p.ore, p.crystal, p.podHp]).toEqual([71, 14, 100]);
    expect(p.buildings.length).toBeGreaterThanOrEqual(1); expect(p.buildings.length).toBeLessThanOrEqual(2);
    expect(p.raid).toBeNull(); expect(p.units.filter(u => u.side === 'foe' && alive(p, u))).toHaveLength(0);
  });
  it('auto defence requires 120% power and counts only clones at base', () => {
    const p = setup(); startRaid(p); const size = p.raid!.size;
    expect(autoDefend(p)).toBeNull(); p.units[0]!.level = 100;
    p.s.hero.pos = { x: 10, y: 10 }; expect(defencePower(p)).toBe(0); expect(autoDefend(p)).toBeNull();
    p.s.hero.pos = { ...p.s.map.start }; expect(defencePower(p)).toBeGreaterThanOrEqual(size * 1.2);
    p.raid!.size = defencePower(p) / 1.2 + .001; expect(autoDefend(p)).toBeNull();
    p.raid!.size = defencePower(p) / 1.2;
    expect(autoDefend(p)).toEqual({ won: true, losses: { ore: 0, crystal: 0, buildings: [] } }); expect(p.raid).toBeNull();
  });
  it('continues a live raid with no returning clones, even after roam marks them wiped', () => {
    const p = setup(); startRaid(p); p.s.hero.alive = false; p.units = p.units.filter(u => u.side === 'foe');
    for (const u of p.units) { entOf(p, u.id)!.pos = { x: 48, y: 47 }; u.nextAt = 0; }
    let lost = false;
    for (let i = 0; i < 150 && p.raid; i++) lost ||= worldTick(p, 1).some(e => e.text === 'raidLost');
    expect(lost).toBe(true); expect(p.podHp).toBe(100);
  });
  it('does not tick raids while away; seed and inputs reproduce events', () => {
    const run = () => { const p = setup(); startRaid(p); p.away = true;
      const before = p.time; expect(worldTick(p, 100)).toEqual([]); expect(p.time).toBe(before);
      p.away = false; const ev = []; for (let i = 0; i < 10; i++) ev.push(...worldTick(p, 1)); return ev; };
    expect(run()).toEqual(run());
  });
});
