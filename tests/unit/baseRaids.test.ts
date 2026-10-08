import { describe, expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { upgradeDrill } from '../../src/sim/base/drill';
import { defencePower, onRaidReturn, RAID_MAX, RAID_REACH, raidPlan, raidSize, startRaid } from '../../src/sim/base/raids';
import { place, POD_MAX } from '../../src/sim/base/buildings';
import { resetRaidPath } from '../../src/sim/base/raidPath';
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
    // the horde still at the edges goes too
    p.raidQueue = [];
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
  it('spawns awake raiders out of the dark a little beyond the base and advances toward the pod', () => {
    const p = setup(); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group)!;
    const e = entOf(p, u.id)!;
    expect(dist(e.pos, p.base)).toBeGreaterThanOrEqual(RAID_REACH - 3);
    expect(u.asleep).toBe(false); const before = dist(e.pos, p.base);
    worldTick(p, 3); expect(dist(e.pos, p.base)).toBeLessThan(before); expect(u.asleep).toBe(false);
  });
  it('an elite breaks the barricade in its way: it stands broken (open ground) until the raid is over', () => {
    const p = setup(); place(p, { x: 48, y: 46 }); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group && !u.swarm) ?? p.units.find(u => u.group === p.raid!.group)!;
    u.swarm = false; u.foe = 'brute'; entOf(p, u.id)!.swarm = false; entOf(p, u.id)!.pos = { x: 48, y: 45 };
    // the only way to the pod's north side is through this barricade
    p.s.map.tiles.fill('wall');
    for (const y of [45, 47]) p.s.map.tiles[y * 96 + 48] = 'floor';
    p.s.map.tiles[46 * 96 + 48] = 'chasm';
    resetRaidPath(p);
    const ev: GEvent[] = [];
    for (let t = 0; t < 40 && !p.buildings[0]!.broken; t++) raidTurn(p, u, t, ev);
    expect(ev.some(e => e.type === 'hit' && e.dst?.startsWith('building'))).toBe(true);
    expect(p.buildings[0]!.broken).toBe(true);
    expect(p.s.map.tiles[46 * 96 + 48]).toBe('floor');
  });
  it('an elite cannot cut diagonally through the corners of barricades', () => {
    const p = setup(); place(p, { x: 49, y: 46 }); place(p, { x: 48, y: 45 }); startRaid(p);
    const u = p.units.find(u => u.group === p.raid!.group)!; const e = entOf(p, u.id)!;
    u.swarm = false; u.foe = 'brute'; e.swarm = false;
    e.pos = { x: 49, y: 45 }; p.s.map.tiles.fill('wall');
    for (const c of [{ x: 49, y: 45 }, { x: 48, y: 46 }, { x: 48, y: 47 }]) p.s.map.tiles[c.y * 96 + c.x] = 'floor';
    for (const b of p.buildings) p.s.map.tiles[b.at.y * 96 + b.at.x] = 'chasm';
    resetRaidPath(p);
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
  it('pod loss keeps the stored materials and every barricade; the pod is left at a quarter to repair', () => {
    const p = setup(); for (let x = 44; x < 47; x++) place(p, { x, y: 44 });
    p.ore = 101; p.crystal = 19; startRaid(p); p.podHp = 0;
    expect(worldTick(p, .1).some(e => e.type === 'dead' && e.text === 'raidLost')).toBe(true);
    expect(p.ore).toBeGreaterThanOrEqual(101); expect(p.crystal).toBeGreaterThanOrEqual(19); expect(p.podHp).toBe(POD_MAX / 4);
    expect(p.buildings).toHaveLength(3); expect(p.buildings.every(b => !b.broken && b.hp === b.maxHp)).toBe(true);
    expect(p.raid).toBeNull(); expect(p.units.filter(u => u.side === 'foe' && alive(p, u))).toHaveLength(0);
    expect(p.manualUlts).toBe(false); expect(p.units.filter(u => u.side === 'hero').every(u => !u.order)).toBe(true);
  });
  it('the defence is the clones at home and nothing else; the raid grows with raids done and with their strength', () => {
    const p = setup(), one = defencePower(p);
    expect(one).toBeGreaterThan(0);
    for (let x = 44; x < 47; x++) place(p, { x, y: 44 });
    expect(defencePower(p)).toBe(one);
    const first = raidSize(p);
    p.raidsDone = 3; expect(raidSize(p)).toBeGreaterThan(first);
    p.raidsDone = 0; p.units[0]!.level = 12;
    expect(raidSize(p)).toBeGreaterThan(first); expect(first).toBeGreaterThanOrEqual(60);
    p.raidsDone = 99; expect(raidSize(p)).toBe(RAID_MAX);
    // the first raid brings no elites and no general; later ones both
    p.raidsDone = 0; expect(raidPlan(p)).toMatchObject({ eliteEvery: 0, general: false });
    p.raidsDone = 4; expect(raidPlan(p).eliteEvery).toBeGreaterThan(0); expect(raidPlan(p).general).toBe(true);
  });
  it('continues a live raid with no returning clones, even after roam marks them wiped', () => {
    const p = setup(); startRaid(p); p.s.hero.alive = false; p.units = p.units.filter(u => u.side === 'foe');
    for (const u of p.units) { entOf(p, u.id)!.pos = { x: 48, y: 47 }; u.nextAt = 0; }
    let lost = false;
    for (let i = 0; i < 150 && p.raid; i++) lost ||= worldTick(p, 1).some(e => e.text === 'raidLost');
    expect(lost).toBe(true); expect(p.podHp).toBeGreaterThanOrEqual(POD_MAX / 4);
  });
  it('does not tick raids while away; seed and inputs reproduce events', () => {
    const run = () => { const p = setup(); startRaid(p); p.away = true;
      const before = p.time; expect(worldTick(p, 100)).toEqual([]); expect(p.time).toBe(before);
      p.away = false; const ev = []; for (let i = 0; i < 10; i++) ev.push(...worldTick(p, 1)); return ev; };
    expect(run()).toEqual(run());
  });
});
