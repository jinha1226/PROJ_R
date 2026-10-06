import { expect, it } from 'vitest';
import { tileAt, type GEvent } from '../../src/sim/grid/types';
import { damage, entOf, strike, unitOf } from '../../src/sim/party/partyCore';
import { gainXp, LEVEL_XP, pickTrait, PROMOTE_LEVEL } from '../../src/sim/party/partyLevel';
import { useUltimate } from '../../src/sim/party/ultimate';
import { KITS } from '../../src/sim/party/classKit';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { delveTick, newDelve } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';

const withArcher = () => {
  const p = newDelve(2);
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1);
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
  expect(e.maxHp).toBe(40 + 8);
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

it('toughness adds health at once; resonance shortens cooldowns; grit holds a killing blow once', () => {
  const p = withArcher();
  const u = clones(p)[0]!, e = entOf(p, u.id)!;
  u.picks = 3; u.offer = ['tough', 'resonance', 'grit'];
  pickTrait(p, u.id, 'tough');
  expect(e.maxHp).toBe(46);
  u.offer = ['resonance', 'grit', 'eagle'];
  pickTrait(p, u.id, 'resonance');
  const f = p.units.find((x) => x.side === 'foe')!;
  entOf(p, f.id)!.pos = { x: e.pos.x + 3, y: e.pos.y };
  f.asleep = false;
  useUltimate(p, u.id);
  expect(u.ultReady).toBeCloseTo(p.time + KITS.archer.ultCd * 0.9);
  u.offer = ['grit', 'eagle', 'sprint'];
  pickTrait(p, u.id, 'grit');
  damage(p, p.time, 'trap', u, 999, []);
  expect(e.alive).toBe(true);
  expect(e.hp).toBe(1);
  damage(p, p.time, 'trap', u, 999, []);
  expect(e.alive).toBe(false);
});

it('an archer shooting again and again from the same spot hits harder with steady aim', () => {
  const p = withArcher();
  const u = clones(p)[0]!;
  u.traits = { steady: 3 };
  const f = p.units.find((x) => x.side === 'foe')!;
  entOf(p, f.id)!.pos = { x: entOf(p, 'hero')!.pos.x + 3, y: entOf(p, 'hero')!.pos.y };
  entOf(p, f.id)!.hp = 9999;
  for (let i = 0; i < 12; i++) strike(p, u, f, p.time, []);
  expect(u.steady).toBe(12);
});

it('the advanced class waits for level 8 on the roaming maps', () => {
  const p = withArcher();
  const u = clones(p)[0]!;
  u.progress = 99; u.traits = { vital: 3 }; u.weapon = 'crossbow'; u.gear!.weapon={id:'bow',def:'crossbow',power:0};
  for (const f of p.units.filter((x) => x.side === 'foe').slice(0, 2)) {
    entOf(p, f.id)!.pos = { x: entOf(p, 'hero')!.pos.x + 6, y: entOf(p, 'hero')!.pos.y };
    damage(p, p.time, 'hero', f, 999, []);
  }
  expect(u.promoteReady).toBeFalsy();
  gainXp(p, u, LEVEL_XP[PROMOTE_LEVEL - 1]!, []);
  expect(u.level).toBeGreaterThanOrEqual(PROMOTE_LEVEL);
  expect(u.promoteReady).toBe(true);
  expect(unitOf(p, u.id)).toBe(u);
});
