import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { canDescend, delveTick, descend, newDelve, type DelveParty } from '../../src/sim/delve/delveSim';
import { takeParty } from '../../src/sim/roam/carry';
import { clones } from '../../src/sim/roam/roam';
import { PACK_SIZE } from '../../src/sim/delve/gear';

const calm = (p: DelveParty) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; delveTick(p, 0.1); };
const archer = (seed = 2, floor = 1) => { const p = newDelve(seed, floor); entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); return p; };
const beside = (p: DelveParty, c: { x: number; y: number }) => {
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const n = { x: c.x + d[0]!, y: c.y + d[1]! };
    if (p.s.map.tiles[n.y * p.s.map.w + n.x] === 'floor') return n;
  }
  throw new Error('no free cell');
};

it('a clone beside a closed chest out of combat opens it and the loot goes to the pack or the stores', () => {
  const p = archer(); calm(p);
  const c = p.chests.find((x) => x.tier === 3)!;
  entOf(p, 'hero')!.pos = beside(p, c.pos);
  const ev = delveTick(p, 0.1);
  expect(c.opened).toBe(true);
  expect(ev.some((e) => e.type === 'open')).toBe(true);
  expect(p.pack.length).toBeGreaterThanOrEqual(2);
  expect(p.crystal).toBeGreaterThan(0);
});

it('a full pack leaves a chest shut', () => {
  const p = archer(); calm(p);
  while (p.pack.length < PACK_SIZE) p.pack.push({ id: `x${p.pack.length}`, def:'windRing',power:0 });
  const c = p.chests[0]!;
  entOf(p, 'hero')!.pos = beside(p, c.pos);
  delveTick(p, 0.1);
  expect(c.opened).toBe(false);
});

it('standing by ore mines it, one ore every two seconds', () => {
  const p = archer(); calm(p);
  const o = p.oreNodes[0]!;
  entOf(p, 'hero')!.pos = beside(p, o.pos);
  const before = o.left;
  for (let i = 0; i < 45; i++) delveTick(p, 0.1);
  expect(o.left).toBe(before - 2);
  expect(p.oreNodes.length).toBeGreaterThan(0);
});

it('the shrine heals everyone once', () => {
  let p = archer(1, 1);
  for (let s = 1; s < 30 && !p.shrine; s++) p = archer(s, 1);
  calm(p);
  entOf(p, 'hero')!.hp = 5;
  entOf(p, 'hero')!.pos = beside(p, p.shrine!.pos);
  delveTick(p, 0.1);
  expect(entOf(p, 'hero')!.hp).toBe(entOf(p, 'hero')!.maxHp);
  expect(p.shrine!.used).toBe(true);
});

it('a fallen clone\'s gear lies where it fell; a living clone can pick it up; leaving the floor loses what is left', () => {
  const p = archer(); calm(p);
  p.bio = 100; p.printHere = true;
  entOf(p, 'hero')!.pos = { ...p.souls[1]!.pos }; delveTick(p, 0.1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start }; for (let i = 0; i < 10; i++) delveTick(p, 0.1);
  const two = clones(p)[1]!;
  const at = { ...entOf(p, two.id)!.pos };
  damage(p, p.time, 'x', two, 999, []);
  delveTick(p, 0.1);
  expect(p.floorItems.length).toBeGreaterThanOrEqual(1);
  entOf(p, 'hero')!.pos = at;
  delveTick(p, 0.1);
  expect(p.pack.length).toBeGreaterThanOrEqual(1);
  p.floorItems.push({ pos: { x: 1, y: 1 }, item: { id: 'z', def:'guardOath',power:0 } });
  expect(JSON.stringify(takeParty(p))).not.toContain('"z"');
});

it('a spike trap hurts whoever steps on it and is found', () => {
  const p = archer(); calm(p);
  const t = p.s.traps[0]!;
  const e = entOf(p, 'hero')!, hp = e.hp;
  e.pos = beside(p, t.pos);
  unitOf(p, 'hero')!.order = { kind: 'move', cell: { ...t.pos } };
  unitOf(p, 'hero')!.nextAt = p.time;
  delveTick(p, 0.1);
  expect(e.hp).toBeLessThan(hp);
  expect(t.found).toBe(true);
});

it('on a boss floor the stairs stay shut until the general falls', () => {
  const p = archer(2, 5);
  for (const u of p.units) if (u.side === 'foe' && u.foe !== 'warlord') entOf(p, u.id)!.alive = false;
  delveTick(p, 0.1);
  for (const u of clones(p)) entOf(p, u.id)!.pos = { ...p.s.map.stairs! };
  delveTick(p, 0.1);
  expect(canDescend(p)).toBe(false);
  const boss = p.units.find((u) => u.foe === 'warlord')!;
  damage(p, p.time, 'hero', boss, 99999, []);
  delveTick(p, 0.1);
  expect(canDescend(p)).toBe(true);
  expect(descend(p)).toBe(true);
  expect(unitOf(p, 'hero')).toBeDefined();
});

it('a clone sent to stand beside an ore vein (holding there) mines it', () => {
  const p = archer(); calm(p);
  const node = p.oreNodes[0]!, at = beside(p, node.pos);
  entOf(p, 'hero')!.pos = at;
  unitOf(p, 'hero')!.order = { kind: 'hold', cell: at };
  const before = p.ore;
  for (let i = 0; i < 40; i++) delveTick(p, 0.1);
  expect(p.ore).toBeGreaterThan(before);
});

it('a band that spots the party reacts a beat late: the clones get the first move', () => {
  const p = newDelve(2, 1);
  const foe = p.units.find((u) => u.side === 'foe' && u.asleep)!;
  const fe = entOf(p, foe.id)!;
  entOf(p, 'hero')!.pos = beside(p, fe.pos);
  unitOf(p, 'hero')!.nextAt = p.time + 0.8;
  const t = p.time;
  delveTick(p, 0.05);
  const band = p.units.filter((u) => u.side === 'foe' && u.group === foe.group);
  expect(band.every((u) => !u.asleep)).toBe(true);
  for (const u of band) expect(u.nextAt).toBeGreaterThanOrEqual(t + 0.9);
  expect(unitOf(p, 'hero')!.nextAt).toBeLessThanOrEqual(p.time + 0.05);
});
