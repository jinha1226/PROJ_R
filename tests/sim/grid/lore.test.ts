import { describe, it, expect } from 'vitest';
import { newLore, POTIONS, potionName, SCROLLS, scrollName } from '../../../src/sim/grid/lore';
import { newState } from '../../../src/sim/grid/state';
import { nextFloor } from '../../../src/sim/grid/run';
import { createRng } from '../../../src/core/rng';
import { GridSim } from '../../../src/sim/grid/gridSim';
import { makeWeapon } from '../../../src/sim/grid/items';
import { heroDmg } from '../../../src/sim/grid/weapons';
import { buffOn } from '../../../src/sim/grid/buffs';
import { dist } from '../../../src/sim/grid/types';
import { handMap, OPEN, sim, sureHits } from './kit';

const R = { x: 1, y: 0 };
const give = (g: GridSim, p: string, n = 1) => { (g.s.hero.gear.potions as Record<string, number>)[p] = n; };
const giveScroll = (g: GridSim, sc: string, n = 1) => { (g.s.hero.gear.scrolls as Record<string, number>)[sc] = n; };

describe('the run\'s lore', () => {
  it('colours and runes are shuffled per seed, the same for the same seed, all different', () => {
    expect(newLore(5)).toEqual(newLore(5));
    expect(POTIONS.some((k) => newLore(5).colors[k] !== newLore(6).colors[k])).toBe(true);
    const l = newLore(9);
    expect(new Set(POTIONS.map((k) => l.colors[k])).size).toBe(POTIONS.length);
    expect(new Set(SCROLLS.map((k) => l.runes[k])).size).toBe(SCROLLS.length);
  });

  it('the shuffle has its own dice (the run\'s rolls do not shift)', () => {
    expect(newState(handMap(OPEN), 4).rng.getState()).toBe(createRng(4).getState());
  });

  it('a potion shows its colour until drunk, then its name, and stays known on the next floor', () => {
    const g = GridSim.create(3);
    give(g, 'haste');
    const before = potionName(g.s, 'haste');
    expect(before).toBe(`${g.s.lore.colors.haste} 물약`);
    const ev = g.act({ kind: 'drink', p: 'haste' });
    expect(ev.some((e) => e.type === 'identify')).toBe(true);
    expect(potionName(g.s, 'haste')).toBe('신속 물약');
    nextFloor(g.s);
    expect(potionName(g.s, 'haste')).toBe('신속 물약');
    expect(scrollName(g.s, 'map')).toBe(`「${g.s.lore.runes.map}」 주문서`);
  });
});

describe('potions', () => {
  it('drinking takes a turn and uses one up; with none it is refused', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    expect(g.act({ kind: 'drink', p: 'cure' })[0]!.type).toBe('blocked');
    give(g, 'cure', 2);
    const t = g.s.time;
    g.act({ kind: 'drink', p: 'cure' });
    expect(g.s.time - t).toBe(1);
    expect(g.s.hero.gear.potions.cure).toBe(1);
  });

  it('strength adds a point and a melee point of damage; cure clears ailments', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    const w = makeWeapon('sword', 1);
    const lo = heroDmg(g.s, w)[0];
    give(g, 'strength');
    g.act({ kind: 'drink', p: 'strength' });
    expect(g.s.hero.str).toBe(11);
    expect(heroDmg(g.s, w)[0]).toBe(lo + 1);
    g.s.hero.status = { burn: 3, freeze: 0, poison: 5 };
    give(g, 'cure');
    g.act({ kind: 'drink', p: 'cure' });
    expect(g.s.hero.status).toEqual({ burn: 0, freeze: 0, poison: 0 });
  });

  it('fire, poison and frost drunk afflict the drinker', () => {
    for (const [p, key] of [['fire', 'burn'], ['poison', 'poison'], ['frost', 'freeze']] as const) {
      const g = sim(OPEN, { x: 5, y: 7 });
      give(g, p);
      g.act({ kind: 'drink', p });
      expect(g.s.hero.status![key]).toBeGreaterThan(0);
    }
  });

  it('haste halves the time of what you do', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    give(g, 'haste');
    g.act({ kind: 'drink', p: 'haste' });
    const t = g.s.time;
    g.act({ kind: 'wait' });
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('confused, a step sometimes goes another way', () => {
    let astray = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = sim(OPEN, { x: 7, y: 7 }, [], seed);
      give(g, 'confuse');
      g.act({ kind: 'drink', p: 'confuse' });
      g.act({ kind: 'move', dir: R });
      if (g.s.hero.pos.x !== 8 || g.s.hero.pos.y !== 7) astray++;
    }
    expect(astray).toBeGreaterThan(3);
    expect(astray).toBeLessThan(30);
  });

  it('invisible: archers hold fire, a foe beside you does not strike, your blow is a sneak attack and ends it', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'archer', pos: { x: 10, y: 7 } }, { kind: 'minion', pos: { x: 5, y: 8 } }]);
    give(g, 'invis');
    g.act({ kind: 'drink', p: 'invis' });
    const hp = g.s.hero.hp;
    for (let i = 0; i < 3; i++) {
      const ev = g.act({ kind: 'wait' });
      expect(ev.some((e) => e.type === 'shoot' && e.src !== 'hero')).toBe(false);
    }
    expect(g.s.hero.hp).toBe(hp);
    sureHits(g);
    g.s.hero.gear.hands[0] = makeWeapon('sword', 1);
    g.s.hero.gear.active = 0;
    const minion = g.s.foes[1]!;
    minion.hp = 99;
    const d = { x: minion.pos.x - g.s.hero.pos.x, y: minion.pos.y - g.s.hero.pos.y };
    const hit = g.act({ kind: 'move', dir: d }).find((e) => e.type === 'hit' && e.src === 'hero');
    expect(hit?.crit).toBe(true);
    expect(buffOn(g.s.hero, 'invis', g.s.time)).toBe(false);
  });

  it('thrown: fire burns where it lands and is known by it; strength just shatters, unknown', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    give(g, 'fire');
    give(g, 'strength');
    g.act({ kind: 'throwPotion', p: 'fire', at: { x: 6, y: 7 } });
    expect(g.s.foes[0]!.status!.burn).toBeGreaterThan(0);
    expect(g.s.lore.known).toContain('potion:fire');
    g.act({ kind: 'throwPotion', p: 'strength', at: { x: 6, y: 6 } });
    expect(g.s.lore.known).not.toContain('potion:strength');
    expect(g.s.hero.gear.potions.strength ?? 0).toBe(0);
  });

  it('a confusion potion thrown leaves foes stumbling about instead of striking', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    give(g, 'confuse');
    g.act({ kind: 'throwPotion', p: 'confuse', at: { x: 6, y: 7 } });
    const f = g.s.foes[0]!;
    expect(buffOn(f, 'confuse', g.s.time)).toBe(true);
    f.pos = { x: 4, y: 7 };
    const hp = g.s.hero.hp;
    g.act({ kind: 'wait' });
    expect(g.s.hero.hp).toBe(hp);
  });
});

describe('scrolls', () => {
  it('identify names one unknown kind you carry; reading names the scroll itself', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    give(g, 'haste');
    giveScroll(g, 'identify');
    g.act({ kind: 'read', sc: 'identify' });
    expect(g.s.lore.known).toEqual(expect.arrayContaining(['scroll:identify', 'potion:haste']));
  });

  it('engrave offers the three-choice; teleport goes far; map shows the floor and its traps', () => {
    const g = sim(OPEN, { x: 2, y: 2 });
    giveScroll(g, 'engrave');
    g.act({ kind: 'read', sc: 'engrave' });
    expect(g.s.offers).toHaveLength(1);
    giveScroll(g, 'teleport');
    const from = { ...g.s.hero.pos };
    g.act({ kind: 'read', sc: 'teleport' });
    expect(dist(from, g.s.hero.pos)).toBeGreaterThanOrEqual(8);
    g.s.traps = [{ pos: { x: 12, y: 12 }, kind: 'spike', found: false }];
    giveScroll(g, 'map');
    g.act({ kind: 'read', sc: 'map' });
    expect(g.s.seen.every((v, i) => v === 1 || g.s.map.tiles[i] === 'wall')).toBe(true);
    expect(g.s.traps[0]!.found).toBe(true);
  });

  it('fear sends nearby foes running; lure wakes the floor and calls it to you; recharge fills the suit', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }, { kind: 'minion', pos: { x: 13, y: 13 }, awake: false }]);
    giveScroll(g, 'fear');
    g.act({ kind: 'read', sc: 'fear' });
    g.act({ kind: 'wait' });
    expect(dist(g.s.foes[0]!.pos, g.s.hero.pos)).toBeGreaterThan(1);
    giveScroll(g, 'lure');
    g.act({ kind: 'read', sc: 'lure' });
    expect(g.s.foes[1]!.awake).toBe(true);
    giveScroll(g, 'recharge');
    g.act({ kind: 'read', sc: 'recharge' });
  });
});

describe('finding potions and scrolls', () => {
  it('walking onto one on the floor picks it up', () => {
    const g = sim(OPEN, { x: 5, y: 7 });
    g.s.floorItems = [{ pos: { x: 6, y: 7 }, item: { kind: 'potion', p: 'haste', name: '?' } }];
    g.act({ kind: 'move', dir: R });
    expect(g.s.hero.gear.potions.haste).toBe(1);
    expect(g.s.floorItems).toHaveLength(0);
  });

  it('a chest can hold one; each floor of a real run has a couple lying about (hand maps none)', () => {
    const g = sim(['#######', '#.C...#', '#######'], { x: 1, y: 1 });
    sureHits(g);
    g.act({ kind: 'move', dir: R });
    const held = Object.values(g.s.hero.gear.potions).concat(Object.values(g.s.hero.gear.scrolls));
    expect(held.reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
    const run = GridSim.create(8);
    expect(run.s.floorItems.filter((f) => f.item.kind === 'potion' || f.item.kind === 'scroll' || f.item.kind === 'arrows')).toHaveLength(2);
    expect(sim(OPEN, { x: 5, y: 7 }).s.floorItems).toHaveLength(0);
  });
});
