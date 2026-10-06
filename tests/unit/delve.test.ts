import { implant } from '../../src/sim/roam/roam';
import { expect, it } from 'vitest';
import { dist } from '../../src/sim/grid/types';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { command } from '../../src/sim/party/partySim';
import { canDescend, delveTick, descend, newDelve, type DelveParty } from '../../src/sim/delve/delveSim';
import { emit } from '../../src/sim/party/triggers';
import { clones } from '../../src/sim/roam/roam';

const take = (p: DelveParty, k: number) => { entOf(p, 'hero')!.pos = { ...p.souls[k]!.pos }; clones(p)[0]!.nextAt = p.time + 0.1; delveTick(p, 0.1); };
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
  p.bio = 100; p.printHere = true;
  take(p, 0); take(p, 1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start };
  for (const u of p.units) if (u.side === 'foe') u.asleep = true;
  p.combat = false;
  for (let i = 0; i < 20; i++) delveTick(p, 0.1);
  const second = clones(p)[1]!;
  implant(p,second,'cleric',[]); second.ready = [0, 0];
  const f = p.units.find((u) => u.side === 'foe' && entOf(p, u.id)!.alive)!;
  entOf(p, f.id)!.hp = 999;
  f.asleep = false; entOf(p, f.id)!.pos = { x: p.s.map.start.x + 4, y: p.s.map.start.y }; f.nextAt = 999;
  entOf(p, 'hero')!.hp = 10;
  entOf(p, second.id)!.pos = { x: p.s.map.start.x, y: p.s.map.start.y+1 };
  const healing: ReturnType<typeof delveTick> = [];
  emit(p,'crisis',{t:p.time,src:clones(p)[0]!,ev:healing});
  let healed = healing.some(e=>e.type==='heal');
  for (let i = 0; i < 40 && !healed; i++) healed = delveTick(p, 0.1).some((e) => e.type === 'heal' && e.src === second.id);
  expect(healed).toBe(true);
});

it('down the stairs: a new floor, the living clones come along, the fallen stay behind', () => {
  const p = newDelve(3);
  p.bio = 100; p.printHere = true;
  take(p, 0); take(p, 1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start };
  for (const u of p.units) if (u.side === 'foe') u.asleep = true;
  p.combat = false;
  for (let i = 0; i < 20; i++) delveTick(p, 0.1);
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

it('when a band notices the party every walk stops where it is', () => {
  const p = newDelve(1);
  take(p, 0);
  const hero = clones(p)[0]!;
  hero.order = { kind: 'move', cell: { x: 12, y: 25 } }; p.leader = 'hero';
  let woke = false;
  for (let i = 0; i < 400 && !woke; i++) woke = delveTick(p, 0.05).some((e) => e.type === 'wake');
  expect(woke).toBe(true);
  expect(p.combat).toBe(true);
  expect(hero.order).toBeNull();
});

it('a carried soul gets no body without bio-matter; foes leave bio-matter when they fall', () => {
  const p = newDelve(2);
  p.printHere = true;
  take(p, 0); take(p, 1);
  entOf(p, 'hero')!.pos = { ...p.s.map.start };
  for (const u of p.units) if (u.side === 'foe') u.asleep = true;
  p.combat = false;
  for (let i = 0; i < 20; i++) delveTick(p, 0.1);
  expect(clones(p)).toHaveLength(1);
  expect(p.carried).toHaveLength(1);
  const foes = p.units.filter((u) => u.side === 'foe');
  for (const f of foes.slice(0, 13)) damage(p, p.time, 'hero', f, 999, []);
  const ev = delveTick(p, 0.1);
  const got = ev.filter((e) => e.type === 'loot' && e.text === 'bio').reduce((n, e) => n + e.amount!, 0);
  expect(got).toBeGreaterThanOrEqual(25);
  // standing by the lift with enough gathered, the carried soul gets its body at once
  expect(clones(p)).toHaveLength(2);
  expect(p.bio).toBe(got - 25);
});

it('below ground nobody wakes when the party falls; at the pod one empty body wakes if there is bio-matter, else it is over', () => {
  const p = newDelve(2);
  p.bio = 100;
  damage(p, 0, 'x', clones(p)[0]!, 999, []);
  expect(delveTick(p, 0.1).some((e) => e.type === 'dead' && e.text === 'lost')).toBe(true);
  expect(p.over).toBe(true);
  p.printHere = true; p.over = false; p.bio = 0;
  const ev = delveTick(p, 0.1);
  expect(p.over).toBe(true);
  expect(ev.some((e) => e.type === 'dead')).toBe(true);
  expect(delveTick(p, 5)).toEqual([]);
  const q = newDelve(2);
  q.bio = 30; q.printHere = true;
  damage(q, 0, 'x', clones(q)[0]!, 999, []);
  for (let i = 0; i < 50; i++) delveTick(q, 0.1);
  expect(q.over).toBeFalsy();
  expect(clones(q).filter((u) => entOf(q, u.id)!.alive)).toHaveLength(1);
  expect(q.bio).toBe(5);
});

it('walking through a door opens it', () => {
  const p = newDelve(2);
  calm(p);
  const m = p.s.map;
  const doors = m.tiles.map((t, i) => (t === 'door' ? i : -1)).filter((i) => i >= 0);
  const d = doors[0]!, cell = { x: d % m.w, y: Math.floor(d / m.w) };
  clones(p)[0]!.order = { kind: 'move', cell };
  const ev: ReturnType<typeof delveTick> = [];
  for (let i = 0; i < 1500 && m.tiles[d] === 'door'; i++) ev.push(...delveTick(p, 0.1));
  expect(m.tiles[d]).toBe('open');
  expect(ev.some((e) => e.type === 'door')).toBe(true);
});

it('an archer with a foe at its side shoots it point-blank instead of only rolling away', () => {
  const p = newDelve(2);
  take(p, 0);
  const f = p.units.find((u) => u.side === 'foe')!, fe = entOf(p, f.id)!;
  const h = entOf(p, 'hero')!;
  h.pos = { x: p.s.map.rooms[0]!.x, y: p.s.map.start.y };
  fe.pos = { x: h.pos.x + 1, y: h.pos.y }; fe.hp = 999; f.asleep = false; f.nextAt = 999;
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    // keep the foe at the archer's side
    fe.pos = { x: h.pos.x + 1, y: h.pos.y };
    if (p.s.map.tiles[fe.pos.y * p.s.map.w + fe.pos.x] !== 'floor') break;
    shots += delveTick(p, 0.1).filter((e) => e.src === 'hero' && e.type === 'shoot').length;
  }
  expect(shots).toBeGreaterThan(1);
});

it('a clone under the hand that walks up to a foe stops at the end of its walk and waits; it does not strike on its own', () => {
  const p = newDelve(2);
  take(p, 0);
  const h = entOf(p, 'hero')!;
  h.pos = { x: p.s.map.rooms[0]!.x, y: p.s.map.start.y };
  const f = p.units.find((u) => u.side === 'foe')!, fe = entOf(p, f.id)!;
  fe.pos = { x: h.pos.x + 3, y: h.pos.y }; fe.hp = 999; f.asleep = false; f.nextAt = 999;
  p.combat = true; p.manual = 'hero';
  for (let i = 0; i < 20 && !p.waiting; i++) delveTick(p, 0.1);
  command(p, { kind: 'move', cell: { x: h.pos.x + 2, y: h.pos.y } });
  const ev: ReturnType<typeof delveTick> = [];
  for (let i = 0; i < 40 && !p.waiting; i++) ev.push(...delveTick(p, 0.1));
  expect(p.waiting).toBe(true);
  expect(ev.some((e) => e.src === 'hero' && (e.type === 'shoot' || e.type === 'bump'))).toBe(false);
  expect(clones(p)[0]!.order).toBeNull();
});
