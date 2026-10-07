import { expect, it } from 'vitest';
import { newDelve, delveTick, descend } from '../../src/sim/delve/delveSim';
import { roomStep } from '../../src/sim/delve/delveRooms';
import { HERO_SOULS } from '../../src/sim/delve/heroSouls';
import { PACK_SIZE } from '../../src/sim/delve/gear';
import { entOf, unitOf, stepToward, damage } from '../../src/sim/party/partyCore';
import { useUltimate } from '../../src/sim/party/ultimate';
import { command } from '../../src/sim/party/partySim';
import { implant, implantCarried, print } from '../../src/sim/roam/roam';
import { placeParty, takeParty } from '../../src/sim/roam/carry';
import { newSurface } from '../../src/sim/overworld/worldSim';
import type { GEvent } from '../../src/sim/grid/types';
const quiet = () => {
  const p = newDelve(2); for (const u of p.units) if (u.side === 'foe') { entOf(p, u.id)!.alive = false; u.reaped = true; }
  delveTick(p, 0.1); p.floorItems = []; p.souls = []; p.chests = []; p.shrine = undefined;
  implant(p, unitOf(p, 'hero')!, 'archer', []); return p;
};
const arena = () => {
  const p = quiet();
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) p.s.map.tiles[y * p.s.map.w + x] = 'floor';
  entOf(p, 'hero')!.pos = { x: 7, y: 7 }; p.s.traps = [];
  return p;
};
it('tier three requires two free slots and guarantees catalog gear, with view state synchronized', () => {
  const p = quiet(), pos = { ...entOf(p, 'hero')!.pos };
  p.chests = [{ pos, tier: 3, opened: false }]; p.s.chests = [{ pos, opened: false }];
  while (p.pack.length < PACK_SIZE - 1) p.pack.push({ id: String(p.pack.length), def:'windRing',power:0 });
  delveTick(p, 0.1); expect(p.chests[0]!.opened).toBe(false);
  p.pack.pop(); delveTick(p, 0.1);
  expect(p.pack).toHaveLength(PACK_SIZE); expect(p.pack.some((i) => 'def'in i)).toBe(true);
  expect(p.s.chests[0]!.opened).toBe(true);
});
it('floor gear drops once during combat, stays with full pack, and can be recovered during combat', () => {
  const p = quiet(), u = print(p, 'warrior', [])!; const e = entOf(p, u.id)!;
  e.pos = { ...entOf(p, 'hero')!.pos }; u.gear!.accessory={id:'acc',def:'windRing',power:0};
  while (p.pack.length < PACK_SIZE) p.pack.push({ id: String(p.pack.length), def:'windRing',power:0 });
  damage(p, p.time, 'trap', u, 9999, []); p.combat = true;
  const ev: GEvent[] = []; roomStep(p, new Map(), ev);
  expect(p.floorItems).toHaveLength(3); expect(u.gear).toBeUndefined(); expect(u.weapon).toBe('fists');
  roomStep(p, new Map(), ev); expect(ev.filter((e) => e.text === 'gear')).toHaveLength(1);
  p.pack.pop(); roomStep(p, new Map(), []); expect(p.floorItems).toHaveLength(2); expect(p.pack).toHaveLength(PACK_SIZE);
});
it('stairs and shaft carry resources and copied souls but leave floor items behind', () => {
  const p = quiet(); p.ore = 7; p.crystal = 3; p.carried = [{ cls: 'mage', hero: 'mira' }]; p.foundHeroes = ['mira'];
  p.floorItems.push({ pos: { x: 1, y: 1 }, item: { id: 'lost', def:'windRing',power:0 } });
  const c = takeParty(p), s = newSurface(2); placeParty(s, c);
  expect(s.ore).toBe(7); expect(s.crystal).toBe(3); expect(JSON.stringify(c)).not.toContain('lost');
  expect(s.carried[0]).not.toBe(c.carried[0]); expect(c.carried[0]).not.toBe(p.carried[0]);
  entOf(p, 'hero')!.pos = { ...p.s.map.stairs! }; expect(descend(p)).toBe(true); expect(p.floorItems).toEqual([]); expect(p.foundHeroes).toContain('mira');
});
it('named souls retain identity on pickup, carry and printing with the correct growth', () => {
  const p = quiet(); p.souls = [{ id: 99, cls: 'mage', hero: 'mira', pos: { ...entOf(p, 'hero')!.pos }, taken: false }];
  delveTick(p, 0.1); expect(p.carried).toEqual([{ cls: 'mage', hero: 'mira', unknown: true }]); expect(p.foundHeroes).toContain('mira');
  const s = newSurface(2); placeParty(s, takeParty(p)); const u = print(s, s.carried.shift(), [])!;
  expect(u).toMatchObject({ hero: 'mira', name: '미라', cls: 'mage', level: 4, xp: 45, traits: HERO_SOULS.mira.traits });
  expect(entOf(s, u.id)!.hp).toBe(entOf(s, u.id)!.maxHp);
});
it('crypt selection excludes expedition discoveries and living named heroes and is deterministic', () => {
  const p = quiet(); implant(p, unitOf(p, 'hero')!, { cls: 'mage', hero: 'mira' }, []); p.foundHeroes = ['aren', 'seraphine', 'kael', 'dorn'];
  for (let seed = 1; seed < 12; seed++) {
    const a = newDelve(seed, 2, takeParty(p)), b = newDelve(seed, 2, takeParty(p));
    expect(a.souls.some((s) => s.hero)).toBe(false); expect(a.rooms).toEqual(b.rooms); expect(a.oreNodes).toEqual(b.oreNodes); expect(a.chests).toEqual(b.chests); expect(a.s.traps).toEqual(b.s.traps); expect(a.souls).toEqual(b.souls);
  }
});
it('manual commands trigger spikes once, shield absorbs damage and stationary ticks do not retrigger', () => {
  const p = arena(), u = unitOf(p, 'hero')!, e = entOf(p, u.id)!; p.s.traps = [{ pos: { x: 8, y: 7 }, kind: 'spike', found: false }];
  u.shield = 20; p.manual = u.id; p.waiting = true; const hp = e.hp;
  const ev = command(p, { kind: 'move', cell: { x: 8, y: 7 } });
  expect(ev.filter((e) => e.type === 'trap')).toHaveLength(1); expect(u.shield).toBeLessThan(20); expect(e.hp).toBe(hp);
  u.order = null; p.waiting = true; expect(delveTick(p, 5).some((e) => e.type === 'trap')).toBe(false);
});
it('each transit entry in a large tick triggers including enemies and alarms wake whole bands within ten', () => {
  const p = arena(), u = unitOf(p, 'hero')!;
  p.s.traps = [{ pos: { x: 8, y: 7 }, kind: 'spike', found: false }, { pos: { x: 9, y: 7 }, kind: 'spike', found: false }];
  // Narrow corridor removes alternatives once the first spike is discovered.
  for (let x = 6; x < 12; x++) for (const y of [6, 8]) p.s.map.tiles[y * p.s.map.w + x] = 'wall';
  u.order = { kind: 'move', cell: { x: 10, y: 7 } }; u.nextAt = p.time;
  const ev = delveTick(p, 2); expect(ev.filter((e) => e.type === 'trap')).toHaveLength(2);
  const foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = true; e.hp = 100; e.pos = { x: 8, y: 7 }; foe.asleep = true;
  p.s.traps = [{ pos: { x: 9, y: 7 }, kind: 'alarm', found: false }];
  const moves: GEvent[] = []; stepToward(p, foe, { x: 9, y: 7 }, p.time, moves); p.onMovement!(moves.slice(), moves);
  expect(moves.some((e) => e.type === 'trap')).toBe(true); expect(foe.asleep).toBe(false);
});
it('rogues spot before path selection and avoid traps without diagonal corner cutting', () => {
  const p = arena(), u = unitOf(p, 'hero')!; implant(p, u, 'rogue', []);
  p.s.traps = [{ pos: { x: 8, y: 7 }, kind: 'spike', found: false }];
  const ev: GEvent[] = []; stepToward(p, u, { x: 9, y: 7 }, p.time, ev);
  expect(ev[0]!.type).toBe('trapFound'); expect(entOf(p, u.id)!.pos).not.toEqual({ x: 8, y: 7 });
  expect(entOf(p, u.id)!.pos).not.toEqual({ x: 8, y: 6 }); expect(entOf(p, u.id)!.pos).not.toEqual({ x: 8, y: 8 });
});
it('mining uses simulation elapsed time and shrine is one shot', () => {
  const p = quiet(), e = entOf(p, 'hero')!; p.oreNodes = [{ pos: { ...e.pos }, left: 3, progress: 0 }];
  p.waiting = true; delveTick(p, 10); expect(p.oreNodes[0]!.progress).toBe(0);
  p.waiting = false; delveTick(p, 2); expect(p.oreNodes[0]!.left).toBe(2);
  p.shrine = { pos: { ...e.pos }, used: false }; e.hp = 1; delveTick(p, 0.1); expect(e.hp).toBe(e.maxHp);
  e.hp = 1; delveTick(p, 0.1); expect(e.hp).toBe(1);
});
it('general loot and victory happen once even after roam has reaped the body', () => {
  const p = newDelve(2, 5), boss = p.units.find((u) => u.foe === 'warlord')!;
  expect(entOf(p, boss.id)!.maxHp).toBe(320); damage(p, p.time, 'hero', boss, 99999, []);
  const ev = delveTick(p, 0.1); expect(boss.reaped).toBe(true); expect(ev.filter((e) => e.type === 'victory')).toHaveLength(1);
  expect(p.floorItems.filter((i) => 'def'in i.item)).toHaveLength(2); expect(p.crystal).toBe(3);
  expect(delveTick(p, 0.1).some((e) => e.type === 'victory')).toBe(false); expect(p.crystal).toBe(3);
});
it('crypt heroes are placed in crypts and same-seed unclaimed souls match', () => {
  let crypts = 0;
  for (let seed = 1; seed < 12; seed++) {
    const a = newDelve(seed, 2), b = newDelve(seed, 2);
    expect(a.souls).toEqual(b.souls);
    for (const soul of a.souls.filter((s) => s.hero)) {
      crypts++;
      expect(a.rooms.some(({ kind, rect: r }) => kind === 'crypt' && soul.pos.x >= r.x && soul.pos.x < r.x + r.w && soul.pos.y >= r.y && soul.pos.y < r.y + r.h)).toBe(true);
    }
  }
  expect(crypts).toBeGreaterThan(0);
});
it('carry constructor preserves discoveries while a fresh expedition excludes only living and carried identities', () => {
  const p = quiet(); implant(p, unitOf(p, 'hero')!, { cls: 'mage', hero: 'mira' }, []); p.foundHeroes.push('aren');
  p.carried.push({ cls: 'rogue', hero: 'dorn' });
  const c = takeParty(p);
  expect(newDelve(4, 1, c).foundHeroes).toContain('aren');
  const fresh = newDelve(4, 1, { ...c, foundHeroes: [] });
  expect(fresh.foundHeroes).toEqual(['mira', 'dorn']); expect(c.foundHeroes).toContain('aren');
});
it('elite loot is independent of bio reaping and emitted once', () => {
  const p = quiet(), foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  p.lootReaped.delete(foe.id); foe.reaped = true; e.elite = true; e.pos = { x: 1, y: 1 };
  p.s.rng.chance = () => true;
  roomStep(p, new Map(), []); expect(p.floorItems).toHaveLength(1);
  roomStep(p, new Map(), []); expect(p.floorItems).toHaveLength(1);
  const it = p.floorItems[0]!.item; expect('def'in it).toBe(true);
});
it('foes entering spikes take damage and a lethal entry prevents subsequent movement in the same tick', () => {
  const p = arena(), foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = true; e.hp = 1; e.pos = { x: 9, y: 7 }; foe.asleep = false; foe.nextAt = p.time;
  foe.order = { kind: 'move', cell: { x: 12, y: 7 } };
  p.s.traps = [{ pos: { x: 10, y: 7 }, kind: 'spike', found: false }];
  const ev = delveTick(p, 4);
  expect(e.alive).toBe(false); expect(e.pos).toEqual({ x: 10, y: 7 });
  expect(ev.filter((e) => e.type === 'move' && e.src === foe.id)).toHaveLength(1);
});
it('crypt pickup and named implantation wait for combat to end for both occupied and empty bodies', () => {
  for (const empty of [false, true]) {
    const p = quiet(), u = unitOf(p, 'hero')!;
    if (empty) { u.cls = 'shell'; u.souls = []; }
    p.souls = [{ id: 5, cls: 'mage', hero: 'mira', pos: { ...entOf(p, u.id)!.pos }, taken: false }];
    const foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
    e.alive = true; e.hp = 100; e.pos = { ...entOf(p, u.id)!.pos }; foe.asleep = false; foe.nextAt = p.time + 100;
    p.combat = true; p.waiting = true;
    delveTick(p, 0.1); expect(p.souls[0]!.taken).toBe(false); expect(u.hero).toBeUndefined(); expect(p.carried).toEqual([]);
    e.alive = false; delveTick(p, 0.1); delveTick(p, 0.1);
    expect(p.souls[0]!.taken).toBe(true);
    expect(p.carried).toEqual([{ cls: 'mage', hero: 'mira', unknown: true }]);
    if (empty) { p.combat = true; expect(implantCarried(p, u.id, 0)).toEqual([]); p.combat = false; implantCarried(p, u.id, 0); expect(u.hero).toBe('mira'); }
  }
});
it('a lethal trap under an earth slam’s landing resolves before the warrior can strike', () => {
  const p = arena(), u = unitOf(p, 'hero')!, me = entOf(p, u.id)!;
  u.souls = []; implant(p, u, 'warrior', []); me.hp = 1; me.pos = { x: 7, y: 7 };
  const foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = true; e.hp = 100; e.pos = { x: 10, y: 7 }; foe.asleep = false;
  for (let y = 6; y <= 8; y++) for (let x = 9; x <= 11; x++) p.s.traps.push({ pos: { x, y }, kind: 'spike', found: false });
  const ev = useUltimate(p, u.id, { x: 9, y: 7 });
  expect(me.alive).toBe(false); expect(e.hp).toBe(100);
  expect(ev.some((v) => v.type === 'hit' && v.src === u.id)).toBe(false);
  expect(ev.filter((v) => v.type === 'trap')).toHaveLength(1);
});
it('guards waking on crypt arrival block named pickup in that same tick', () => {
  const p = arena(); p.souls = [{ id: 4, pos: { x: 7, y: 7 }, cls: 'mage', hero: 'mira', taken: false }];
  const foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = true; e.hp = 100; e.pos = { x: 9, y: 7 }; foe.asleep = true;
  p.combat = false; delveTick(p, 0.1);
  expect(foe.asleep).toBe(false); expect(p.combat).toBe(true);
  expect(p.souls[0]!.taken).toBe(false); expect(p.carried).toEqual([]);
});
it('an alarm starting a fight stops the manual clone and companions immediately', () => {
  const p = arena(), hero = unitOf(p, 'hero')!, companion = print(p, 'warrior', [])!;
  entOf(p, companion.id)!.pos = { x: 7, y: 9 };
  companion.order = { kind: 'move', cell: { x: 12, y: 9 } };
  const foe = p.units.find((u) => u.side === 'foe')!, e = entOf(p, foe.id)!;
  e.alive = true; e.hp = 100; e.pos = { x: 12, y: 7 }; foe.asleep = true;
  p.s.traps = [{ pos: { x: 8, y: 7 }, kind: 'alarm', found: false }];
  p.manual = hero.id; p.waiting = true; p.combat = false;
  const ev = command(p, { kind: 'move', cell: { x: 11, y: 7 } });
  expect(ev.some((e) => e.type === 'trap')).toBe(true); expect(foe.asleep).toBe(false); expect(p.combat).toBe(true);
  expect(hero.order).toBeNull(); expect(companion.order).toBeNull();
});
it('the stairs leave snares, gravity wells, burning ground and sanctuaries behind on the floor they were set', () => {
  const p = quiet();
  p.snares = [{ at: { x: 2, y: 2 }, by: 'hero', kind: 'bolt', charges: 3, ready: 0 }];
  p.wells = [{ at: { x: 2, y: 2 }, by: 'hero', until: 9, next: 0 }];
  p.grounds = [{ at: { x: 2, y: 2 }, by: 'hero', until: 9, next: 0 }];
  p.zones = [{ at: { x: 2, y: 2 }, by: 'hero', until: 9, next: 0, r: 2 }];
  entOf(p, 'hero')!.pos = { ...p.s.map.stairs! }; expect(descend(p)).toBe(true);
  expect(p.snares ?? []).toEqual([]); expect(p.wells ?? []).toEqual([]); expect(p.grounds ?? []).toEqual([]); expect(p.zones ?? []).toEqual([]);
});
