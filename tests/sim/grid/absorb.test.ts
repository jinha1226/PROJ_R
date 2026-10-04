import { FAMILY, ELITE_MULT, absorbOffer } from '../../../src/sim/grid/absorb';
import { BASE_IDS, ENGRAVES, ENGRAVE_IDS } from '../../../src/sim/grid/engraveCore';
import { FOE_XP, foeDmg, scaleFoe } from '../../../src/sim/grid/foes';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { makeWeapon } from '../../../src/sim/grid/items';
import { nextFloor, settleKills } from '../../../src/sim/grid/run';
import { newState } from '../../../src/sim/grid/state';
import { FOES, type FoeKind } from '../../../src/sim/grid/types';
import { handMap, OPEN, sim, sureHits } from './kit';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateMap } from '../../../src/sim/grid/mapgen';

it('preserves the existing floor layout, spawns and contents apart from elite flags', () => {
  const hashes = [1, 6, 11].map((floor) => {
    const m = generateMap(21, floor);
    for (const spot of m.toolSpots ?? []) {
      for (let y = spot.room.y; y < spot.room.y + spot.room.h; y++) for (let x = spot.room.x; x < spot.room.x + spot.room.w; x++) m.tiles[y * m.w + x] = 'wall';
      m.tiles[spot.pos.y * m.w + spot.pos.x] = 'wall';
      m.chests = m.chests.filter(c => c.x < spot.room.x || c.x >= spot.room.x + spot.room.w || c.y < spot.room.y || c.y >= spot.room.y + spot.room.h);
    }
    delete m.hidden; delete m.toolSpots;
    const plain = { ...m, spawns: m.spawns.map(({ kind, pos, group }) => ({ kind, pos, group })) };
    return createHash('sha256').update(JSON.stringify(plain)).digest('hex');
  });
  expect(hashes).toMatchInlineSnapshot(`
    [
      "c7b60efdf41b3fd9ae73b50c8ce5ccff46f673583632c54481223a3aecc9ec9c",
      "48adbc2090613c742f31151732827d3e849b0ade7a4e31cc5d50748dc59c1250",
      "6a0bc2cca906bbe24b189fc5533adefcedf8899376eeb5a5d4274f74faf32a6b",
    ]
  `);
});

it('maps every foe to its engraving family', () => {
  expect(FAMILY).toEqual({ minion: 'melee', brute: 'melee', archer: 'ranged', mage: 'element', ghoul: 'fusion', champion: 'fusion' });
});

it('marks one or two deterministic elites on ordinary floors and none on boss floors', () => {
  for (const seed of [3, 8, 21]) for (let floor = 1; floor <= 15; floor++) {
    const m = generateMap(seed, floor);
    const elites = m.spawns.filter((f) => f.elite);
    if ([5, 10, 15].includes(floor)) expect(elites).toHaveLength(0);
    else {
      expect(elites.length).toBeGreaterThanOrEqual(1);
      expect(elites.length).toBeLessThanOrEqual(2);
      expect(elites.every((f) => f.kind !== 'champion')).toBe(true);
    }
    expect(generateMap(seed, floor)).toEqual(m);
  }
});

it('scales elite health and power and gives triple XP, settling each death once', () => {
  const map = handMap(OPEN);
  map.spawns = [{ kind: 'brute', pos: { x: 2, y: 1 }, group: 1, elite: true }];
  const s = newState(map, 3);
  const f = s.foes[0]!;
  expect(ELITE_MULT).toBe(1.6);
  const base = scaleFoe('brute', 1);
  expect(f).toMatchObject({ elite: true, hp: Math.round(base.hp * 1.6), maxHp: Math.round(base.hp * 1.6) });
  expect(f.power).toBeCloseTo(base.power * 1.6);
  expect(foeDmg(f)).toEqual(FOES.brute.dmg.map((n) => Math.round(n * base.power * 1.6)));
  f.alive = false;
  const before = new Set([f.id]);
  settleKills(s, before);
  settleKills(s, before);
  expect(s.hero.xp).toBe(FOE_XP.brute * 3);
  expect(s.floorItems).toHaveLength(1);
});

it('keeps records across floors and applies generated elite flags on descent', () => {
  const s = newState(handMap(OPEN), 21);
  s.records.push('finisher');
  nextFloor(s);
  expect(s.records).toContain('finisher');
  const elites = s.foes.filter((f) => f.elite);
  expect(elites.length).toBeGreaterThanOrEqual(1);
  for (const f of elites) {
    const base = scaleFoe(f.kind as FoeKind, 2);
    expect(f.hp).toBe(Math.round(base.hp * ELITE_MULT));
    expect(f.power).toBeCloseTo(base.power * ELITE_MULT);
  }
});

it.each(['minion', 'brute', 'archer', 'mage', 'ghoul', 'champion'] as const)('a defeated %s immediately offers its family and leaves remains alongside existing items', (kind) => {
  const map = handMap(OPEN);
  map.spawns = [{ kind, pos: { x: 2, y: 1 }, group: 1, elite: kind !== 'champion' }];
  const s = newState(map, 3, 'pistol', kind === 'champion' ? 15 : 1);
  s.floorItems.push({ pos: { x: 2, y: 1 }, item: makeWeapon('sword', 1) });
  const g = GridSim.fromState(s);
  sureHits(g);
  s.foes[0]!.hp = 1;
  g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(s.offers).toHaveLength(1);
  expect(s.offers[0]!.every(id => typeof id === 'object' || ENGRAVES[id].family === FAMILY[kind])).toBe(true);
  expect(s.floorItems).toContainEqual({ pos: { x: 2, y: 1 }, item: { kind: 'material', mat: 'remains', n: kind === 'champion' ? 3 : 1 } });
  expect(s.floorItems.some(f => (f.item.kind as string) === 'echo')).toBe(false);
  expect(s.floorItems.some((f) => f.item.kind === 'weapon')).toBe(true);
  if (kind === 'champion') expect(s.floorItems.some((f) => f.item.kind === 'core')).toBe(true);
});

it('ordinary foes give material drops and normal XP without offers', () => {
  const g = sim(OPEN, { x: 1, y: 1 }, [{ kind: 'minion', pos: { x: 2, y: 1 } }]);
  expect(g.s.foes[0]!.elite).toBeFalsy();
  g.s.foes[0]!.hp = 1;
  sureHits(g);
  g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(g.s.offers).toEqual([]);
  expect(g.s.floorItems[0]?.item).toEqual({ kind: 'material', mat: 'scrap', n: 1 });
  expect(g.s.hero.xp).toBe(FOE_XP.minion);
});

it('offers on death with no added time, queues three fitting engravings, and excludes suit engravings', () => {
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.records = ['dash', 'finisher', 'leap'];
  g.s.hero.suit = ['dash'];
  g.s.offers = [['rapid']];
  const f = newState({ ...handMap(OPEN), spawns: [{ kind: 'minion', pos: { x: 2, y: 1 }, group: 1, elite: true }] }, 3).foes[0]!;
  f.alive = false; g.s.foes = [f];
  settleKills(g.s, new Set([f.id]));
  const events = g.s.events;
  expect(g.s.time).toBe(0);
  expect(events).toContainEqual({ t: 0, type: 'absorb', src: 'hero', text: 'melee' });
  expect(g.s.offers[0]).toEqual(['rapid']);
  const offer = g.s.offers[1]!;
  expect(offer).toHaveLength(3);
  expect(offer.every((id) => typeof id === 'object' || (ENGRAVES[id].family === 'melee' && id !== 'dash'))).toBe(true);
  expect(new Set(offer).size).toBe(3);
});

it('fills short pools regardless of recorded history', () => {
  const s = newState(handMap(OPEN), 3);
  s.hero.rounds = ['fire', 'frost'];
  s.records = ['dash'];
  expect(absorbOffer(s, 'melee')).toHaveLength(3);
  s.records = [...ENGRAVE_IDS];
  expect(absorbOffer(s, 'melee').map((id) => typeof id === 'string' && s.records.includes(id))).toEqual([true, true, true]);
  s.records = [];
  expect(absorbOffer(s, 'ranged')).toHaveLength(3);
  s.hero.suit = ENGRAVE_IDS.filter(id => ENGRAVES[id].family === 'element' && id !== 'elemArrow');
  expect(absorbOffer(s, 'element')).toEqual(['elemArrow']);
  s.hero.suit.push('elemArrow');
  expect(absorbOffer(s, 'element')).toEqual([]);
});

it('uses only the requested family with deterministic draws', () => {
  for (const family of ['melee', 'ranged', 'element', 'fusion'] as const) {
    const a = newState(handMap(OPEN), 87);
    const b = newState(handMap(OPEN), 87);
    expect(absorbOffer(a, family)).toEqual(absorbOffer(b, family));
    const picks = absorbOffer(a, family);
    expect(picks.every((id) => typeof id === 'object' || ENGRAVES[id].family === family)).toBe(true);
  }
  const s = newState(handMap(OPEN), 3);
  s.records = ['dash', 'rapid'];
  expect(absorbOffer(s, 'fusion')).toHaveLength(3);
});

it('leaves remains without queuing empty offers when the family is exhausted', () => {
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.hero.rounds = ['fire', 'frost'];
  g.s.hero.suit = ENGRAVE_IDS.filter(id => ENGRAVES[id].family === 'element');
  const f = newState({ ...handMap(OPEN), spawns: [{ kind: 'mage', pos: { x: 2, y: 1 }, group: 1, elite: true }] }, 3).foes[0]!;
  f.alive = false; g.s.foes = [f];
  settleKills(g.s, new Set([f.id]));
  expect(g.s.events.some(e => e.type === 'absorb')).toBe(true);
  expect(g.s.floorItems[0]?.item).toEqual({ kind: 'material', mat: 'remains', n: 1 });
  expect(g.s.offers).toEqual([]);
});

it('records a newly chosen engraving once, but not existing records or passed offers', () => {
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.offers = [['finisher'], ['dash'], ['leap']];
  expect(g.act({ kind: 'choose', i: 0 })).toContainEqual({ t: 0, type: 'record', src: 'hero', text: 'finisher' });
  expect(g.s.records.filter((id) => id === 'finisher')).toHaveLength(1);
  expect(g.act({ kind: 'choose', i: 0 }).some((e) => e.type === 'record')).toBe(false);
  expect(g.act({ kind: 'choose', i: null }).some((e) => e.type === 'record')).toBe(false);
  expect(g.s.records).not.toContain('leap');
  expect(g.s.time).toBe(0);
});

it('does not record a refused full-suit choice and records a successful replacement', () => {
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.hero.suit = ['dash', 'rapid', 'chain', 'momentum', 'leap', 'counter'];
  g.s.offers = [['finisher']];
  expect(g.act({ kind: 'choose', i: 0 })[0]!.type).toBe('blocked');
  expect(g.s.records).not.toContain('finisher');
  expect(g.act({ kind: 'choose', i: 0, slot: 2 }).some((e) => e.type === 'record')).toBe(true);
  expect(g.s.hero.suit[2]).toBe('finisher');
});

it('seeds independent per-run records with the four starting engravings', () => {
  const a = newState(handMap(OPEN), 3);
  const b = newState(handMap(OPEN), 3);
  expect(a.records).toEqual(['dash', 'rapid', 'chain', 'momentum']);
  a.records.push('leap');
  expect(b.records).not.toContain('leap');
});


it('puts a locked engraving of the requested family first', () => {
  for (let seed = 1; seed <= 20; seed++) for (const family of ['melee', 'ranged', 'element', 'fusion'] as const) {
    const s = newState(handMap(OPEN), seed);
    s.run.unlocked = [];
    const offer = absorbOffer(s, family);
    expect(offer).toHaveLength(3);
    const first = offer[0]!;
    expect(typeof first === 'string' && ENGRAVES[first].base).toBe(true);
    expect(new Set(offer).size).toBe(3);
    expect(offer.every(id => typeof id === 'object' || !s.hero.suit.includes(id))).toBe(true);
  }
  const s = newState(handMap(OPEN), 3);
  s.run.unlocked = BASE_IDS.filter(id => id !== 'gunRelay');
  expect(absorbOffer(s, 'fusion')[0]).toBe('gunRelay');
});
it('tastes locked base choices once, even previously recorded ones', () => {
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.run.unlocked = [];
  g.s.offers = [['dash'], ['dash']];
  g.act({ kind: 'choose', i: 0 });
  expect(g.s.run.tasted).toEqual(['dash']);
  g.s.hero.suit = [];
  g.act({ kind: 'choose', i: 0 });
  expect(g.s.run.tasted).toEqual(['dash']);
});
it('does not taste unlocked, refused, or passed choices; missing unlocks means all unlocked', () => {
  for (const unlocked of [undefined, BASE_IDS]) {
    const g = sim(OPEN, { x: 1, y: 1 });
    g.s.run.unlocked = unlocked;
    g.s.offers = [['dash'], ['finisher']];
    g.act({ kind: 'choose', i: 0 }); g.act({ kind: 'choose', i: 0 });
    expect(g.s.run.tasted ?? []).toEqual([]);
  }
  const g = sim(OPEN, { x: 1, y: 1 });
  g.s.run.unlocked = [];
  g.s.hero.suit = ['dash', 'rapid', 'chain', 'momentum', 'leap', 'counter'];
  g.s.offers = [['gunRelay']];
  g.act({ kind: 'choose', i: 0 });
  expect(g.s.run.tasted ?? []).toEqual([]);
  g.act({ kind: 'choose', i: 0, slot: 0 });
  expect(g.s.run.tasted).toEqual(['gunRelay']);
  g.s.offers = [['execute']];
  g.act({ kind: 'choose', i: null });
  expect(g.s.run.tasted).toEqual(['gunRelay']);
});
