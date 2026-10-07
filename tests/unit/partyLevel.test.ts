import { implantCarried } from '../../src/sim/roam/roam';
import { expect, it } from 'vitest';
import { tileAt, type GEvent } from '../../src/sim/grid/types';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { gainXp, LEVEL_XP, pickTrait } from '../../src/sim/party/partyLevel';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';

const withArcher = () => {
  const p = newDelve(2);
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); implantCarried(p, 'hero', 0);
  // These combat fixtures put their target three cells east: choose a clear lane without cover.
  for (const r of p.s.map.rooms) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x; x < r.x + r.w - 4; x++) {
    if ([0, 1, 2, 3, 4].every((dx) => [-1, 0, 1].every((dy) => tileAt(p.s.map, { x: x + dx, y: y + dy }) === 'floor'))) {
      entOf(p, 'hero')!.pos = { x, y };
      return p;
    }
  }
  throw new Error('No combat fixture lane');
};

it('experience raises the level: more health and a pick among three traits of the common pool and the clone\'s own line', () => {
  const p = withArcher();
  const u = clones(p)[0]!, e = entOf(p, u.id)!;
  const ev: GEvent[] = [];
  gainXp(p, u, LEVEL_XP[2]!, ev);
  expect(u.level).toBe(3);
  expect(ev.filter((x) => x.type === 'levelUp')).toHaveLength(2);
  expect(e.maxHp).toBe(Math.round(40 * 1.16));
  expect(u.picks).toBe(2);
  expect(u.offer).toHaveLength(3);
  for (const t of u.offer!) expect(TRAITS[t]!.pool==='common'||TRAITS[t]!.pool==='archer').toBe(true);
  pickTrait(p, u.id, u.offer![0]!);
  expect(u.picks).toBe(1);
  expect(u.offer).toHaveLength(3);
});

it('an empty body gains nothing', () => {
  const p = newDelve(2);
  const ev: GEvent[] = [];
  gainXp(p, clones(p)[0]!, 999, ev);
  expect(clones(p)[0]!.level).toBeUndefined();
});

it('foes that fall near a clone give it experience', () => {
  const p = withArcher();
  const f = p.units.find((u) => u.side === 'foe')!;
  entOf(p, f.id)!.pos = { x: entOf(p, 'hero')!.pos.x + 2, y: entOf(p, 'hero')!.pos.y };
  damage(p, p.time, 'hero', f, 999, []);
  delveTick(p, 0.1);
  expect(clones(p)[0]!.xp).toBeGreaterThan(0);
});

it('picking a card spends a pick; a law picked again is its upgrade', () => {
  const p = withArcher();
  const u = clones(p)[0]!;
  u.picks = 2; u.offer = ['finish', 'bond', 'cruel'];
  pickTrait(p, u.id, 'finish');
  expect(u.traits?.finish).toBe(1); expect(u.picks).toBe(1);
  u.offer = ['finish', 'bond', 'cruel'];
  pickTrait(p, u.id, 'finish');
  expect(u.traits?.finish).toBe(2); expect(u.picks).toBe(0);
});

it('an archer shooting again and again from the same spot builds steady aim up to three', () => {
  const p = withArcher();
  const u = clones(p)[0]!;
  u.traits = {};
  const f = p.units.find((x) => x.side === 'foe')!;
  entOf(p, f.id)!.pos = { x: entOf(p, 'hero')!.pos.x + 3, y: entOf(p, 'hero')!.pos.y };
  entOf(p, f.id)!.hp = 9999;
  for (let i = 0; i < 12; i++) strike(p, u, f, p.time, []);
  expect(u.steady).toBe(3);
});

