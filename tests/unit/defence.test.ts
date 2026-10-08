import { expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { breakBuilding, canPlace, LEVELS, place, repairBuilding, repairPod, upgradeBuilding, buildingsAt } from '../../src/sim/base/buildings';
import { startRaid, defencePower } from '../../src/sim/base/raids';
import { orbitalLaser, orbitalStrike, unlockSupport, SUPPORT } from '../../src/sim/base/support';
import { towerTick } from '../../src/sim/base/raidAi';
import { raidField } from '../../src/sim/base/raidPath';
import { entOf } from '../../src/sim/party/partyCore';
import { idx } from '../../src/sim/grid/types';
import { BUILD_NAMES } from '../../src/ui/overworld/buildMode';

const base = () => { const p = newSurface(42); p.ore = 900; p.crystal = 100; p.bio = 100; for (const u of p.units) if (u.side === 'hero') u.nextAt = 1e9; return p; };
const spot = (p: ReturnType<typeof base>, kind: Parameters<typeof canPlace>[1]) => {
  for (let r = 3; r <= 7; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const c = { x: p.base.x + dx, y: p.base.y + dy }; if (canPlace(p, kind, c)) return c; }
  throw new Error('no spot');
};

it('the defences go by SF names and a shock mine joins them', () => {
  expect([BUILD_NAMES.watchtower, BUILD_NAMES.wall, BUILD_NAMES.palisade, BUILD_NAMES.shockMine]).toEqual(['포탑', '방벽', '바리케이드', '전기 지뢰']);
});

it('an upgrade raises its stats a level at a time (three at most) and costs what its row says', () => {
  const p = base(), at = spot(p, 'watchtower'); place(p, 'watchtower', at);
  const b = buildingsAt(p, at)!, ore = p.ore;
  expect(b.level ?? 1).toBe(1);
  expect(upgradeBuilding(p, b.id)).toBe(true);
  expect(b.level).toBe(2); expect(b.maxHp).toBe(LEVELS.watchtower!.hp[1]); expect(p.ore).toBe(ore - LEVELS.watchtower!.cost[0]![0]);
  expect(upgradeBuilding(p, b.id)).toBe(true); expect(upgradeBuilding(p, b.id)).toBe(false); expect(b.level).toBe(3);
});

it('a turret reaches farther and hits harder with each level', () => {
  const shot = (level: number) => {
    const p = base(), at = spot(p, 'watchtower'); place(p, 'watchtower', at); const b = buildingsAt(p, at)!;
    for (let l = 1; l < level; l++) upgradeBuilding(p, b.id);
    startRaid(p); p.raidQueue = [];
    const range = LEVELS.watchtower!.range![level - 1]!;
    const f = p.units.find((u) => u.group === p.raid!.group)!, e = entOf(p, f.id)!;
    e.pos = { x: at.x + range, y: at.y }; f.sx = e.pos.x + 0.5; f.sy = e.pos.y + 0.5; e.hp = e.maxHp = 999;
    b.nextAt = p.time; towerTick(p, []); return 999 - e.hp;
  };
  expect(shot(1)).toBeGreaterThan(0); expect(shot(3)).toBeGreaterThan(shot(1));
});

it('a broken building does nothing and blocks nothing until repaired; repairs cost ore', () => {
  const p = base(), at = spot(p, 'wall'); place(p, 'wall', at);
  const b = buildingsAt(p, at)!;
  breakBuilding(p, b);
  expect(b.broken).toBe(true); expect(p.s.map.tiles[idx(p.s.map, at)]).not.toBe('wall');
  expect(raidField(p)[idx(p.s.map, at)]).toBeLessThan(8);
  const ore = p.ore;
  expect(repairBuilding(p, b.id)).toBe(true);
  expect(b.broken).toBe(false); expect(b.hp).toBe(b.maxHp); expect(p.ore).toBeLessThan(ore); expect(p.s.map.tiles[idx(p.s.map, at)]).toBe('wall');
});

it('a shock mine hurts and shocks the raider that steps on it', () => {
  const p = base(), at = spot(p, 'shockMine'); expect(place(p, 'shockMine', at)).toBe(true);
  startRaid(p); p.raidQueue = [];
  const f = p.units.find((u) => u.group === p.raid!.group)!, e = entOf(p, f.id)!;
  e.pos = { ...at }; f.sx = at.x + 0.5; f.sy = at.y + 0.5; e.hp = e.maxHp = 999;
  towerTick(p, []);
  expect(e.hp).toBeLessThan(999); expect((f.status.shock?.until ?? 0) > p.time).toBe(true);
});

it('orbital strike and laser are unlocked with crystal, hit what they should and wait their cooldown', () => {
  const p = base(); startRaid(p); p.raidQueue = [];
  const foes = p.units.filter((u) => u.group === p.raid!.group).slice(0, 3);
  const at = { x: p.base.x + 8, y: p.base.y };
  foes.forEach((f, i) => { const e = entOf(p, f.id)!; e.pos = { x: at.x + i - 1, y: at.y }; f.sx = e.pos.x + 0.5; f.sy = e.pos.y + 0.5; e.hp = e.maxHp = 999; });
  expect(orbitalStrike(p, at, [])).toBe(false);
  expect(unlockSupport(p, 'strike')).toBe(true); expect(unlockSupport(p, 'laser')).toBe(true);
  expect(orbitalStrike(p, at, [])).toBe(true);
  for (const f of foes) expect(entOf(p, f.id)!.hp).toBeLessThan(999);
  expect(orbitalStrike(p, at, [])).toBe(false);
  const hp = foes.map((f) => entOf(p, f.id)!.hp);
  expect(orbitalLaser(p, at, [])).toBe(true);
  expect(foes.some((f, i) => entOf(p, f.id)!.hp < hp[i]!)).toBe(true);
  p.time += SUPPORT.strike.cd; expect(orbitalStrike(p, at, [])).toBe(true);
});

it('a lost raid keeps the stored materials and leaves the pod to repair', () => {
  const p = base(); startRaid(p); p.raidQueue = [];
  const ore = p.ore;
  p.podHp = 0; worldTick(p, 0.05);
  expect(p.raid).toBeNull(); expect(p.ore).toBeGreaterThanOrEqual(ore);
  expect(p.podHp).toBeLessThan(200);
  expect(repairPod(p)).toBe(true); expect(p.podHp).toBe(200);
});

it('auto-defence weighs the base against the new horde size', () => {
  const p = base();
  const before = defencePower(p);
  const at = spot(p, 'watchtower'); place(p, 'watchtower', at); upgradeBuilding(p, buildingsAt(p, at)!.id);
  expect(defencePower(p)).toBeGreaterThan(before);
});
