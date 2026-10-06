import { expect, it } from 'vitest';
import { dist } from '../../src/sim/grid/types';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { command } from '../../src/sim/party/partySim';
import { canDescend, delveTick, descend, newDelve, type DelveParty } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';

const take = (p: DelveParty, k: number) => { entOf(p, 'hero')!.pos = { ...p.souls[k]!.pos }; delveTick(p, 0.1); };
const calm = (p: DelveParty) => { for (const u of p.units) if (u.side === 'foe') entOf(p, u.id)!.alive = false; };

it('one empty clone steps out of the lift; the first soul (an archer) lies in the same room; the bands sleep', () => {
  for (const seed of [1, 2, 3]) {
    const p = newDelve(seed);
    expect(clones(p)).toHaveLength(1);
    expect(clones(p)[0]!.cls).toBe('shell');
    expect(p.souls[0]!.cls).toBe('archer');
    const r = p.s.map.rooms.find((x) => p.s.map.start.x >= x.x && p.s.map.start.x < x.x + x.w && p.s.map.start.y >= x.y && p.s.map.start.y < x.y + x.h);
    if (r) expect(p.souls[0]!.pos.x >= r.x && p.souls[0]!.pos.x < r.x + r.w).toBe(true);
    expect(p.units.filter((u) => u.side === 'foe').every((u) => u.asleep)).toBe(true);
    expect(new Set(p.souls.slice(0, 3).map((s) => s.cls)).size).toBe(Math.min(3, p.souls.length));
  }
});

it('turn-based: time stops on the hand-controlled clone\'s moment and runs again after its command', () => {
  const p = newDelve(2);
  take(p, 0);
  const band = p.units.find((u) => u.side === 'foe')!;
  const fe = entOf(p, band.id)!;
  fe.pos = { x: entOf(p, 'hero')!.pos.x + 3, y: entOf(p, 'hero')!.pos.y };
  band.asleep = false; p.combat = true; p.manual = 'hero';
  for (let i = 0; i < 30 && !p.waiting; i++) delveTick(p, 0.1);
  expect(p.waiting).toBe(true);
  const t = p.time;
  delveTick(p, 1);
  expect(p.time).toBe(t);
  const ev = command(p, { kind: 'attack', target: band.id });
  expect(ev.some((e) => e.src === 'hero' && (e.type === 'shoot' || e.type === 'bump' || e.type === 'move'))).toBe(true);
  expect(p.waiting).toBe(false);
  for (let i = 0; i < 30 && !p.waiting; i++) delveTick(p, 0.1);
  expect(p.waiting).toBe(true);
  expect(p.time).toBeGreaterThan(t);
});

it('a walk under the player\'s hand goes on by itself until it arrives', () => {
  const p = newDelve(2);
  calm(p);
  p.combat = true; p.manual = 'hero';
  for (let i = 0; i < 10 && !p.waiting; i++) delveTick(p, 0.1);
  const goal = { x: p.s.map.start.x + 2, y: p.s.map.start.y };
  command(p, { kind: 'move', cell: goal });
  for (let i = 0; i < 60 && !p.waiting; i++) delveTick(p, 0.1);
  expect(entOf(p, 'hero')!.pos).toEqual(goal);
});

it('a companion heals the hurt by itself', () => {
  const p = newDelve(2);
  take(p, 0); take(p, 1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start }; for (let i = 0; i < 20; i++) delveTick(p, 0.1);
  const second = clones(p)[1]!;
  second.cls = 'cleric'; second.weapon = 'mace';
  const f = p.units.find((u) => u.side === 'foe')!;
  f.asleep = false; entOf(p, f.id)!.pos = { x: p.s.map.start.x + 4, y: p.s.map.start.y }; f.nextAt = 999;
  entOf(p, 'hero')!.hp = 10;
  let healed = false;
  for (let i = 0; i < 40 && !healed; i++) healed = delveTick(p, 0.1).some((e) => e.type === 'heal' && e.src === second.id);
  expect(healed).toBe(true);
});

it('down the stairs: a new floor, the living clones come along, the fallen stay behind', () => {
  const p = newDelve(3);
  take(p, 0); take(p, 1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start }; for (let i = 0; i < 20; i++) delveTick(p, 0.1);
  calm(p); delveTick(p, 0.1);
  const two = clones(p)[1]!.id;
  expect(canDescend(p)).toBe(false);
  const st = p.s.map.stairs!;
  for (const u of clones(p)) entOf(p, u.id)!.pos = { ...st };
  delveTick(p, 0.1);
  expect(canDescend(p)).toBe(true);
  expect(descend(p)).toBe(true);
  expect(p.floor).toBe(2);
  expect(clones(p).map((u) => u.id)).toEqual(['hero', two]);
  for (const u of clones(p)) expect(dist(entOf(p, u.id)!.pos, p.s.map.start)).toBeLessThanOrEqual(2);
  expect(p.units.filter((u) => u.side === 'foe').every((u) => u.asleep)).toBe(true);
  damage(p, p.time, 'x', unitOf(p, two)!, 999, []);
  expect(() => { for (let i = 0; i < 100; i++) delveTick(p, 0.1); }).not.toThrow();
});

it('left alone a floor never throws', () => {
  const p = newDelve(5);
  for (let i = 0; i < 2000; i++) expect(() => delveTick(p, 0.1)).not.toThrow();
});
