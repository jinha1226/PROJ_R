import { describe, expect, it } from 'vitest';
import { newSurface, worldTick } from '../../src/sim/overworld/worldSim';
import { barricadeCap, barricadesLeft, BARRICADE_HP, BARRICADE_MAX, BARRICADE_START, BARRICADE_STEP, breakBuilding, buildingsAt, canPlace, pickUp, place, podRepairCost, POD_MAX, repairPod } from '../../src/sim/base/buildings';
import { canPost, setPost } from '../../src/sim/base/posts';
import { startRaid } from '../../src/sim/base/raids';
import { canHit, entOf, unitOf } from '../../src/sim/party/partyCore';
import { dist, same, tileAt, walkable, type GEvent } from '../../src/sim/grid/types';

/** the twelve cells round the pod */
const ring = (p: ReturnType<typeof newSurface>) => {
  const b = p.base, out: { x: number; y: number }[] = [];
  for (let y = b.y - 1; y <= b.y + 2; y++) for (let x = b.x - 1; x <= b.x + 2; x++) if (x < b.x || x > b.x + 1 || y < b.y || y > b.y + 1) out.push({ x, y });
  return out;
};

describe('barricades', () => {
  it('are a limited stock that costs nothing: laid on our own open ground, taken up again by day', () => {
    const p = newSurface(42), at = { x: p.base.x - 4, y: p.base.y - 4 }, ore = p.ore;
    expect(barricadeCap(p)).toBe(BARRICADE_START); expect(barricadesLeft(p)).toBe(BARRICADE_START);
    expect(place(p, at)).toBe(true);
    expect(p.ore).toBe(ore); expect(barricadesLeft(p)).toBe(BARRICADE_START - 1);
    expect(walkable(tileAt(p.s.map, at))).toBe(false); expect(buildingsAt(p, at)?.hp).toBe(BARRICADE_HP);
    // not twice on one cell, not off our ground
    expect(canPlace(p, at)).toBe(false); expect(canPlace(p, { x: 2, y: 2 })).toBe(false);
    expect(pickUp(p, p.buildings[0]!.id)).toBe(true);
    expect(walkable(tileAt(p.s.map, at))).toBe(true); expect(barricadesLeft(p)).toBe(BARRICADE_START);
  });

  it('a clone merely standing on the cell steps aside for the barricade', () => {
    const p = newSurface(42), e = entOf(p, 'hero')!;
    e.pos = { x: p.base.x - 4, y: p.base.y - 4 };
    const at = { ...e.pos }, ev: GEvent[] = [];
    expect(place(p, at, ev)).toBe(true);
    expect(same(e.pos, at)).toBe(false); expect(dist(e.pos, at)).toBeLessThanOrEqual(2); expect(walkable(tileAt(p.s.map, e.pos))).toBe(true);
    expect(ev).toMatchObject([{ type: 'move', src: 'hero', to: e.pos }]);
  });

  it('the stock runs out, and the workshop widens it up to its most', () => {
    const p = newSurface(42);
    let n = 0;
    for (let x = p.base.x - 8; x <= p.base.x + 8 && n < 40; x++) if (place(p, { x, y: p.base.y - 6 })) n++;
    for (let x = p.base.x - 8; x <= p.base.x + 8 && n < 40; x++) if (place(p, { x, y: p.base.y + 7 })) n++;
    expect(n).toBe(BARRICADE_START); expect(barricadesLeft(p)).toBe(0);
    p.upgrades = { stock: 1 }; expect(barricadesLeft(p)).toBe(BARRICADE_STEP);
    p.upgrades = { stock: 99 }; expect(barricadeCap(p)).toBe(BARRICADE_MAX);
  });

  it('never close the last way to the pod: the last gap of a ring is refused, and a clone plugs it instead', () => {
    const p = newSurface(42), cells = ring(p);
    const laid = cells.filter((c) => place(p, c));
    expect(laid.length).toBe(cells.length - 1);
    const gap = cells.find((c) => !buildingsAt(p, c))!;
    expect(canPlace(p, gap)).toBe(false);
    expect(canPost(p, 'hero', gap)).toBe(true);
  });

  it('stop feet, not shots: a clone shoots over one', () => {
    const p = newSurface(42), u = unitOf(p, 'hero')!, e = entOf(p, 'hero')!;
    place(p, { x: e.pos.x + 1, y: e.pos.y });
    startRaid(p); p.raidQueue = [];
    const f = p.units.find((x) => x.group === p.raid!.group)!;
    entOf(p, f.id)!.pos = { x: e.pos.x + 3, y: e.pos.y };
    expect(canHit(p, u, f)).toBe(true);
  });

  it('a raid may break them; they stand whole again when it is over, and none is laid or taken up while it lasts', () => {
    const p = newSurface(42), at = { x: p.base.x - 4, y: p.base.y - 4 };
    place(p, at); startRaid(p); p.raidQueue = [];
    const b = p.buildings[0]!;
    expect(canPlace(p, { x: at.x + 1, y: at.y })).toBe(false); expect(pickUp(p, b.id)).toBe(false);
    breakBuilding(p, b);
    expect(b.broken).toBe(true); expect(walkable(tileAt(p.s.map, at))).toBe(true);
    for (const u of p.units.filter((x) => x.group === p.raid!.group)) entOf(p, u.id)!.alive = false;
    worldTick(p, 0.1);
    expect(p.raid).toBeNull(); expect(b.broken).toBe(false); expect(b.hp).toBe(BARRICADE_HP); expect(walkable(tileAt(p.s.map, at))).toBe(false);
    expect(p.lastRaid?.buildings).toEqual([b.id]);
  });

  it('a post is not laid over, and a barricade is no post', () => {
    const p = newSurface(42), at = { x: p.base.x - 4, y: p.base.y - 4 };
    expect(setPost(p, 'hero', at)).toBe(true);
    expect(canPlace(p, at)).toBe(false);
    place(p, { x: at.x + 1, y: at.y });
    expect(canPost(p, 'hero', { x: at.x + 1, y: at.y })).toBe(false);
  });

  it('the pod is mended for ore: a point of ore for every six of health', () => {
    const p = newSurface(42); p.ore = 100; p.podHp = POD_MAX - 60;
    expect(podRepairCost(p)).toBe(10);
    expect(repairPod(p)).toBe(true); expect(p.ore).toBe(90); expect(p.podHp).toBe(POD_MAX);
    expect(repairPod(p)).toBe(false);
  });
});
