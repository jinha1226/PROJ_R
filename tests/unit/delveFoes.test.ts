import { expect, it } from 'vitest';
import type { GEvent } from '../../src/sim/grid/types';
import { damage, entOf, stats } from '../../src/sim/party/partyCore';
import { foeTurn } from '../../src/sim/party/partyFoeAi';
import { CLASSES, FOES } from '../../src/sim/party/partyDefs';
import { dist, tileAt, walkable } from '../../src/sim/grid/types';
import { delveTick, newDelve, FODDER_HP } from '../../src/sim/delve/delveSim';

it('a shaman mends a hurt band-mate instead of attacking, then waits', () => {
  for (let seed = 1; seed < 40; seed++) {
    const p = newDelve(seed, 4);
    const sh = p.units.find((u) => u.foe === 'shaman');
    if (!sh) continue;
    const mate = p.units.find((u) => u.side === 'foe' && u.group === sh.group && u !== sh);
    if (!mate) continue;
    for (const u of p.units) if (u.group === sh.group) u.asleep = false;
    // Keep the healer and patient in reach, and the hero inside the roam leash.
    const at = entOf(p, sh.id)!.pos;
    entOf(p, mate.id)!.pos = { x: at.x + 1, y: at.y };
    entOf(p, 'hero')!.pos = { x: at.x, y: at.y + 2 };
    entOf(p, 'hero')!.hp = entOf(p, 'hero')!.maxHp = 10000;
    for (const u of p.units) u.nextAt = u === sh ? 0 : 100;
    entOf(p, mate.id)!.hp = 3;
    const ev: GEvent[] = [];
    for (let i = 0; i < 30; i++) ev.push(...delveTick(p, 0.1));
    expect(ev.filter((e) => e.type === 'heal' && e.src === sh.id)).toHaveLength(1);
    expect(entOf(p, mate.id)!.hp).toBe(15);
    expect(ev.some((e) => e.t === 0 && e.src === sh.id && e.type === 'shoot')).toBe(false);
    return;
  }
  throw new Error('no shaman with a band-mate found');
});

it('the general telegraphs its slam, and calls goblins once at half health', () => {
  const p = newDelve(2, 5);
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1);
  const w = p.units.find((u) => u.foe === 'warlord')!;
  for (const u of p.units) if (u.group === w.group) u.asleep = false;
  const we = entOf(p, w.id)!;
  entOf(p, 'hero')!.pos = { x: we.pos.x + 1, y: we.pos.y };
  // Freeze the band and use a healthy clone so the fight survives the call window.
  entOf(p, 'hero')!.hp = entOf(p, 'hero')!.maxHp = 10000;
  for (const u of p.units) u.nextAt = u === w ? p.time : 100;
  const ev: GEvent[] = [];
  for (let i = 0; i < 40; i++) ev.push(...delveTick(p, 0.1));
  expect(ev.some((e) => e.type === 'telegraph' && e.src === w.id)).toBe(true);
  damage(p, p.time, 'x', w, Math.ceil(we.hp - we.maxHp * 0.45), []);
  const more: GEvent[] = [];
  for (let i = 0; i < 30; i++) more.push(...delveTick(p, 0.1));
  expect(more.filter((e) => e.type === 'summon' && e.src === w.id)).toHaveLength(3);
  for (let i = 0; i < 120; i++) more.push(...delveTick(p, 0.1));
  expect(more.filter((e) => e.type === 'summon' && e.src === w.id)).toHaveLength(3);
});

function bossArena() {
  const p = newDelve(2, 5), w = p.units.find((u) => u.foe === 'warlord')!;
  const we = entOf(p, w.id)!, hero = entOf(p, 'hero')!;
  p.souls.forEach((s) => { s.taken = true; });
  for (const u of p.units) { u.nextAt = 1000; if (u !== w && u.side === 'foe') { entOf(p, u.id)!.alive = false; u.reaped = true; } }
  w.asleep = false; w.nextAt = 0;
  // top level: a kill gives no level-up that would refit the test's huge health
  p.units.find((u) => u.id === 'hero')!.level = 15;
  // no suit: the slam's raw damage is measured
  p.units.find((u) => u.id === 'hero')!.gear!.armor = null;
  hero.pos = { x: we.pos.x + 1, y: we.pos.y }; hero.hp = hero.maxHp = 10000;
  return { p, w, we, hero };
}

it('slam waits for impact, repeats only after nine seconds, and dies with its caster', () => {
  const { p, w, hero } = bossArena();
  const start = delveTick(p, 0.01);
  expect(start.find((e) => e.type === 'telegraph')).toMatchObject({ src: w.id, amount: 2, text: 'slam' });
  expect(delveTick(p, 1.48).some((e) => e.type === 'react')).toBe(false);
  expect(hero.hp).toBe(10000);
  const hit = delveTick(p, 0.02).find((e) => e.type === 'hit' && e.src === w.id)!;
  expect(hit.t).toBeCloseTo(1.5);
  expect(hit.amount).toBeGreaterThanOrEqual(Math.round(12 * 1.6));
  expect(hit.amount).toBeLessThanOrEqual(Math.round(16 * 1.6));
  const later: GEvent[] = [];
  for (let i = 0; i < 100; i++) later.push(...delveTick(p, 0.1));
  const telegraphs = [...start, ...later].filter((e) => e.type === 'telegraph' && e.src === w.id);
  expect(telegraphs).toHaveLength(2);
  expect(telegraphs[1]!.t - telegraphs[0]!.t).toBeGreaterThanOrEqual(9);
  const other = bossArena();
  delveTick(other.p, 0.01);
  damage(other.p, other.p.time, 'hero', other.w, other.we.hp, []);
  expect(delveTick(other.p, 2).some((e) => e.type === 'react' && e.src === other.w.id)).toBe(false);
  expect(other.hero.hp).toBe(10000);
});

it('reinforcements occupy distinct free cells, inherit scaling, and call only once', () => {
  const { p, w, we } = bossArena();
  we.hp = Math.floor(we.maxHp * 0.45);
  const events: GEvent[] = [];
  foeTurn(p, w, 0, events);
  const summons = events.filter((e) => e.type === 'summon');
  expect(summons).toHaveLength(3);
  expect(new Set(summons.map((e) => `${e.to!.x},${e.to!.y}`)).size).toBe(3);
  for (const event of summons) {
    const u = p.units.find((u) => u.id === event.dst)!, e = entOf(p, u.id)!;
    expect(u).toMatchObject({ foe: 'goblin', asleep: false, group: w.group });
    expect(dist(we.pos, e.pos)).toBeLessThanOrEqual(3);
    expect(walkable(tileAt(p.s.map, e.pos))).toBe(true);
    expect(e.maxHp).toBe(Math.round(29 * 1.6));
    expect(stats(u).dmg).toEqual([3, 8]);
  }
  foeTurn(p, w, 1.5, events); foeTurn(p, w, 3, events);
  expect(events.filter((e) => e.type === 'summon')).toHaveLength(3);
});

it('floor scaling applies to every foe (fodder from its own base), with elite HP only and faster ghouls', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const p = newDelve(seed, 4), scale = 1.45;
    for (const u of p.units.filter((u) => u.side === 'foe')) {
      const e = entOf(p, u.id)!, def = FOES[u.foe!];
      expect(e.maxHp).toBe(Math.round((u.fodder ? FODDER_HP : def.hp) * scale * (e.elite ? 1.8 : 1)));
      expect(stats(u).dmg).toEqual(def.dmg.map((n) => Math.round(n * scale)));
    }
  }
  expect(FOES.ghoul.atk).toBe(0.7); expect(FOES.ghoul.move).toBe(0.55);
});

it('new foe kinds yield their XP exactly once and leave no bio loot', () => {
  for (const [kind, xp] of [['ghoul', 4], ['shaman', 6], ['warlord', 60]] as const) {
    const { p, w, we, hero } = bossArena();
    // Other bodies were removed only to isolate combat, so exclude their rewards.
    for (const u of p.units) if (u !== w && u.side === 'foe') u.reaped = true;
    const h = p.units.find((u) => u.id === 'hero')!;
    h.cls = 'archer'; h.weapon = CLASSES.archer.weapons[0]; h.gear!.weapon = { id: 'bw', def: 'longbow', power: 0 }; w.foe = kind; we.elite = false;
    damage(p, 0, 'hero', w, we.hp, []);
    const ev = delveTick(p, 0.01);
    expect(ev.some((e) => e.type === 'loot' && e.text === 'bio')).toBe(false); expect(h.xp).toBe(xp);
    delveTick(p, 0.01);
    expect(h.xp).toBe(xp); expect(hero.alive).toBe(true);
  }
});

it('shaman selects the lowest health fraction and obeys range, waking and cooldown', () => {
  const { p, w, we } = bossArena();
  w.foe = 'shaman'; we.hp = we.maxHp;
  const mates = p.units.filter((u) => u.side === 'foe' && u !== w).slice(0, 3);
  mates.forEach((u, i) => {
    const e = entOf(p, u.id)!;
    e.alive = true; u.asleep = false; e.maxHp = 100; e.hp = 20 + i * 10;
    e.pos = { x: we.pos.x + i + 1, y: we.pos.y };
  });
  mates[0]!.asleep = true;
  entOf(p, mates[2]!.id)!.pos.x = we.pos.x + 6;
  const events: GEvent[] = [];
  expect(foeTurn(p, w, 0, events)).toBe(1.5);
  expect(events[0]).toMatchObject({ type: 'heal', dst: mates[1]!.id, amount: 12 });
  expect(foeTurn(p, w, 5.99, events)).toBeUndefined();
  expect(events).toHaveLength(1);
  mates[0]!.asleep = false;
  foeTurn(p, w, 6, events);
  expect(events[1]).toMatchObject({ type: 'heal', dst: mates[0]!.id, amount: 12 });
});
