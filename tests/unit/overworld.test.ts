import { expect, it } from 'vitest';
import { distanceMap } from '../../src/sim/grid/path';
import { dist, idx } from '../../src/sim/grid/types';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { generateWorld, WORLD_SIZE } from '../../src/sim/overworld/worldGen';
import { clones, newWorld, orderTo, worldTick } from '../../src/sim/overworld/worldSim';

it('near the ship only small strays wait; the nearest camps are small and farther out', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = generateWorld(seed);
    const r = (c: { x: number; y: number }) => Math.hypot(c.x - w.base.x, c.y - w.base.y);
    expect(w.strays.length).toBeGreaterThanOrEqual(3);
    for (const st of w.strays) {
      expect(r(st.pos)).toBeLessThanOrEqual(19);
      expect(w.map.spawns.filter((sp) => sp.group === st.group).length).toBeLessThanOrEqual(2);
      expect(w.map.spawns.filter((sp) => sp.group === st.group).every((sp) => sp.kind === 'minion')).toBe(true);
    }
    for (const c of w.camps.filter((x) => x.tier === 1)) {
      expect(r(c.pos)).toBeGreaterThanOrEqual(21);
      expect(w.map.spawns.filter((sp) => sp.group === c.group)).toHaveLength(3);
    }
  }
});

it('the world is the same for the same seed and different for another', () => {
  expect(generateWorld(4).ground).toEqual(generateWorld(4).ground);
  expect(generateWorld(4).ground).not.toEqual(generateWorld(5).ground);
});

it('camps sit on three rings round the base, stronger farther out, and every camp can be walked to', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = generateWorld(seed);
    expect(w.camps.length).toBeGreaterThanOrEqual(6);
    const d = distanceMap(w.map, w.map.start);
    for (const c of w.camps) {
      expect(d[idx(w.map, c.pos)]).toBeGreaterThan(0);
      const r = Math.hypot(c.pos.x - w.base.x, c.pos.y - w.base.y);
      expect(r).toBeGreaterThan(c.tier === 1 ? 15 : c.tier === 2 ? 26 : 36);
    }
    expect(w.map.w).toBe(WORLD_SIZE);
  }
});

it('one empty clone wakes by the ship on claimed land; it sees only what is near and the camps sleep', () => {
  const p = newWorld(3);
  expect(clones(p)).toHaveLength(1);
  expect(clones(p)[0]!.cls).toBe('shell');
  expect(p.claimed[idx(p.s.map, p.s.hero.pos)]).toBe(1);
  expect(p.s.visible.size).toBeLessThan(400);
  expect(p.units.filter((u) => u.side === 'foe').every((u) => u.asleep)).toBe(true);
  expect(p.combat).toBe(false);
});

it('souls lie about: the first (an archer) near the ship, the nearest three of different classes', () => {
  for (const seed of [1, 2, 3, 4]) {
    const w = generateWorld(seed);
    const r = (c: { x: number; y: number }) => Math.hypot(c.x - w.base.x, c.y - w.base.y);
    expect(r(w.souls[0]!.pos)).toBeLessThanOrEqual(15);
    expect(w.souls[0]!.cls).toBe('archer');
    expect(new Set(w.souls.slice(0, 3).map((s) => s.cls)).size).toBe(3);
    for (const c of w.camps) expect(w.souls.some((s) => dist(s.pos, c.pos) <= 3)).toBe(true);
    const d = distanceMap(w.map, w.map.start);
    for (const s of w.souls) expect(d[idx(w.map, s.pos)]).toBeGreaterThan(0);
    // a second soul lies outside any camp, close enough to reach first
    expect(w.souls.filter((s) => w.camps.every((c) => dist(s.pos, c.pos) > 3) && r(s.pos) < 24).length).toBeGreaterThanOrEqual(2);
  }
});

it('an empty clone that reaches a soul becomes its class', () => {
  const p = newWorld(3);
  const soul = p.souls[0]!;
  orderTo(p, 'hero', soul.pos);
  for (let i = 0; i < 400 && !soul.taken; i++) worldTick(p, 0.1);
  expect(soul.taken).toBe(true);
  expect(clones(p)[0]!.cls).toBe(soul.cls);
  expect(entOf(p, 'hero')!.maxHp).toBeGreaterThan(30);
});

const calm = (p: ReturnType<typeof newWorld>) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; };

it('a soul picked up by a clone that has one is carried home; at the ship it gets a new body', () => {
  const p = newWorld(3);
  calm(p);
  p.bio = 100;
  const [a, b] = p.souls;
  entOf(p, 'hero')!.pos = { ...a!.pos };
  worldTick(p, 0.1);
  entOf(p, 'hero')!.pos = { ...b!.pos };
  worldTick(p, 0.1);
  expect(p.carried).toEqual([b!.cls]);
  orderTo(p, 'hero', p.s.map.start);
  for (let i = 0; i < 600 && p.carried.length; i++) worldTick(p, 0.1);
  expect(clones(p).length).toBeGreaterThanOrEqual(2);
  expect(clones(p)[1]!.cls).toBe(b!.cls);
});

it('out of combat an order walks the whole party there behind the chosen clone', () => {
  const p = newWorld(3);
  calm(p);
  p.bio = 100;
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; worldTick(p, 0.1);
  entOf(p, 'hero')!.pos = { ...p.souls[1]!.pos }; worldTick(p, 0.1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start, x: p.s.map.start.x + 2 }; worldTick(p, 0.1);
  const two = clones(p)[1]!.id;
  const goal = { x: p.s.map.start.x + 5, y: p.s.map.start.y + 3 };
  orderTo(p, two, goal);
  for (let i = 0; i < 200; i++) worldTick(p, 0.1);
  expect(entOf(p, two)!.pos).toEqual(goal);
  expect(dist(entOf(p, 'hero')!.pos, goal)).toBeLessThanOrEqual(2);
});

it('a fallen clone drops its soul; when the last one falls the ship wakes a new empty body (if it has the bio-matter)', () => {
  const p = newWorld(3);
  p.bio = 25;
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; worldTick(p, 0.1);
  const at = { ...entOf(p, 'hero')!.pos };
  damage(p, p.time, 'x', clones(p)[0]!, 999, []);
  const ev = worldTick(p, 0.1);
  expect(ev.some((e) => e.type === 'drop' && e.text === 'soul')).toBe(true);
  expect(p.souls.at(-1)!.pos).toEqual(at);
  for (let i = 0; i < 50; i++) worldTick(p, 0.1);
  const fresh = clones(p).filter((u) => entOf(p, u.id)!.alive);
  expect(fresh).toHaveLength(1);
  expect(fresh[0]!.cls).toBe('shell');
});

it('walking up to a camp wakes it all at once and starts a fight; clearing it claims the land round it', () => {
  const p = newWorld(3);
  const camp = p.camps[0]!;
  const band = p.units.filter((u) => u.group === camp.group);
  entOf(p, 'hero')!.pos = { ...camp.pos };
  const ev = worldTick(p, 0.1);
  expect(band.every((u) => !u.asleep)).toBe(true);
  expect(ev.filter((e) => e.type === 'wake')).toHaveLength(1);
  expect(p.combat).toBe(true);
  for (const u of band) damage(p, p.time, 'hero', u, 999, []);
  const after = worldTick(p, 0.1);
  expect(camp.cleared).toBe(true);
  expect(p.claimed[idx(p.s.map, camp.pos)]).toBe(1);
  expect(after.some((e) => e.text === 'claim')).toBe(true);
});

it('a blow on one sleeping camp foe wakes its whole camp', () => {
  const p = newWorld(3);
  const band = p.units.filter((u) => u.group === p.camps[1]!.group);
  damage(p, 0, 'hero', band[0]!, 1, []);
  expect(band.every((u) => !u.asleep)).toBe(true);
});

it('left alone the party never throws over a long stretch of the world', () => {
  const p = newWorld(9);
  orderTo(p, 'hero', p.camps[0]!.pos);
  for (let i = 0; i < 3000; i++) expect(() => worldTick(p, 0.1)).not.toThrow();
});

it('in a fight a fighter told to hold a spot steps out to meet a foe that comes near, and goes back after', () => {
  const p = newWorld(3);
  for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false;
  const w = clones(p)[0]!;
  w.cls = 'warrior'; w.weapon = 'swordShield';
  const spot = { ...entOf(p, 'hero')!.pos };
  w.order = { kind: 'hold', cell: spot };
  const [f, far] = p.units.filter((u) => u.side === 'foe');
  const fe = entOf(p, f!.id)!;
  fe.alive = true; fe.hp = 999; f!.asleep = false; f!.nextAt = 999;
  fe.pos = { x: spot.x + 3, y: spot.y };
  // a second foe farther off keeps the fight going (when the fight ends a hold is let go)
  const fa = entOf(p, far!.id)!;
  fa.alive = true; fa.hp = 999; far!.asleep = false; far!.nextAt = 999;
  fa.pos = { x: spot.x - 8, y: spot.y };
  let met = false;
  for (let i = 0; i < 60 && !met; i++) { worldTick(p, 0.1); met = dist(entOf(p, 'hero')!.pos, fe.pos) <= 1; }
  expect(met).toBe(true);
  fe.alive = false;
  for (let i = 0; i < 60; i++) worldTick(p, 0.1);
  expect(entOf(p, 'hero')!.pos).toEqual(spot);
});
