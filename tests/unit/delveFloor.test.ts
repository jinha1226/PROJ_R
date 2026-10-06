import { expect, it } from 'vitest';
import { generateFloor } from '../../src/sim/delve/delveGen';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { takeParty } from '../../src/sim/roam/carry';
import { implant, clones } from '../../src/sim/roam/roam';

it('arrival preserves generated chests and traps, and does not wake bands at the lift', () => {
  for (let seed = 0; seed < 30; seed++) {
    const p = newDelve(seed, 3), f = generateFloor(seed, 3);
    expect(p.s.chests).toEqual(f.chests.map((c) => ({ pos: c.pos, opened: false })));
    expect(p.s.traps).toEqual(f.map.traps);
    delveTick(p, 0.1);
    expect(p.combat).toBe(false);
    expect(p.units.filter((u) => u.side === 'foe').every((u) => u.asleep)).toBe(true);
  }
});

it('only an arrival without a classed clone gets the first-floor tutorial archer in the start room', () => {
  const source = newDelve(9), blankCarry = takeParty(source);
  const bare = newDelve(9, 1, blankCarry);
  const inside = (p: ReturnType<typeof newDelve>, i: number, room: number) => {
    const c = p.souls[i]!.pos, r = p.s.map.rooms[room]!;
    return c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h;
  };
  expect(bare.souls[0]!.cls).toBe('archer'); expect(inside(bare, 0, 0)).toBe(true);
  implant(source, clones(source)[0]!, 'warrior', []);
  const armed = newDelve(9, 1, takeParty(source));
  for (const p of [bare, armed, newDelve(9, 2)]) {
    const f = generateFloor(p.seed, p.floor);
    for (let i = p === bare ? 1 : 0; i < p.souls.length; i++) expect(f.rooms.some((r, j) => r.kind === 'normal' && inside(p, i, j))).toBe(true);
  }
  const a = newDelve(9, 4), b = newDelve(9, 4);
  expect(a.s.map).toEqual(b.s.map); expect(a.souls).toEqual(b.souls);
});
