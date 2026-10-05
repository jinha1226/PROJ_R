import { freshMeta } from '../../src/sim/grid/meta';
import { spendMeta } from '../bot/brain/campaign';
import { runBot } from '../bot/runBot';
import { runCampaign } from '../bot/brain/campaign';
import { pickOffer, scoreCard } from "../bot/brain/build";
import { describe, expect, it } from 'vitest';
import { GridSim } from '../../src/sim/grid/gridSim';
import { add, DIRS, idx, type Ent } from '../../src/sim/grid/types';
import { dangerCells, isChoke } from '../bot/brain/view';
import { createMemory, smartDecide } from '../bot/brain/policy';

function arena() {
  const sim = GridSim.create(1000), s = sim.s;
  s.map = { w: 15, h: 15, tiles: Array.from({ length: 225 }, (_, i) =>
    i % 15 === 0 || i % 15 === 14 || i < 15 || i >= 210 ? 'wall' : 'floor'),
  rooms: [], start: { x: 7, y: 7 }, exits: [], chests: [], spawns: [] };
  s.hero.pos = { x: 7, y: 7 }; s.foes = []; s.chests = []; s.barrels = [];
  s.traps = []; s.floorItems = []; s.upgrades = []; s.offers = [];
  s.visible = new Set(Array.from({ length: 225 }, (_, i) => i)); s.seen = new Uint8Array(225).fill(1);
  return sim;
}
function foe(sim: GridSim, x: number, y: number, hp = 14, kind: Ent['kind'] = 'minion') {
  const f: Ent = { id: `f${sim.s.foes.length}`, kind, pos: { x, y }, hp, maxHp: hp,
    alive: true, awake: true, nextAt: 100, group: 1 };
  sim.s.foes.push(f); return f;
}
function mark(sim: GridSim) {
  const s = sim.s;
  s.telegraphs.push({ cells: [{ ...s.hero.pos }], center: { ...s.hero.pos },
    src: 'mage', kind: 'spell', dmg: [2, 4], at: s.hero.nextAt + 1 });
}
describe('bot stance and view', () => {
  it('swaps to its blade before an adjacent melee attack', () => {
    const sim = arena(), mem = createMemory(); foe(sim, 8, 7);
    expect(smartDecide(sim, mem)).toEqual({ kind: 'swap' });
    sim.act({ kind: 'swap' });
    expect(smartDecide(sim, mem)).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
  });
  it('includes the hero in marked danger', () => {
    const sim = arena(); mark(sim);
    expect(dangerCells(sim.s).has(idx(sim.s.map, sim.s.hero.pos))).toBe(true);
  });
  it('recognises corridors and room centres in a generated map', () => {
    const s = GridSim.create(1000).s;
    const cells = s.map.tiles.flatMap((t, i) => t === 'floor' ? [{ x: i % s.map.w, y: Math.floor(i / s.map.w) }] : []);
    expect(cells.some(c => isChoke(s, c))).toBe(true);
    const room = cells.find(c => DIRS.slice(0, 4).every(d => s.map.tiles[idx(s.map, add(c, d))] === 'floor'))!;
    expect(isChoke(s, room)).toBe(false);
  });
});
describe('bot tactics', () => {
  it('steps out of a telegraph', () => {
    const sim = arena(); mark(sim);
    const action = smartDecide(sim, createMemory());
    expect(action.kind).toBe('move');
    if (action.kind === 'move') expect(dangerCells(sim.s).has(idx(sim.s.map, add(sim.s.hero.pos, action.dir)))).toBe(false);
  });
  it('melees the killable adjacent foe', () => {
    const sim = arena(); sim.s.hero.gear.active = 1;
    foe(sim, 8, 7); foe(sim, 6, 7, 1);
    expect(smartDecide(sim, createMemory())).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
  });
  it('shoots an archer ahead of a minion', () => {
    const sim = arena(); foe(sim, 7, 4); const archer = foe(sim, 10, 7, 8, 'archer');
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'shoot', target: archer.id });
  });
  it('rests safely at half health', () => {
    const sim = arena(); sim.s.hero.hp = sim.s.hero.maxHp / 2;
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'wait' });
  });
});
describe('bot items', () => {
  it('uses belt healing at 30% health in combat', () => {
    const sim = arena(); sim.s.hero.hp = sim.s.hero.maxHp * 0.3; foe(sim, 8, 7);
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'use', item: 'potion' });
  });
  it('identifies an unknown potion only at full health in safety', () => {
    const sim = arena(); sim.s.hero.gear.potions.fire = 1;
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'drink', p: 'fire' });
    foe(sim, 8, 7);
    expect(smartDecide(sim, createMemory()).kind).not.toBe('drink');
  });
  it('throws known fire at a distant cluster', () => {
    const sim = arena(); sim.s.hero.gear.potions.fire = 1; sim.s.lore.known.push('potion:fire');
    const f = foe(sim, 10, 7); foe(sim, 10, 8);
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'throwPotion', p: 'fire', at: f.pos });
  });
});

describe('bot build scoring', () => {
  it('chooses reclaim for the starting fusion suit', () => {
    const s = arena().s; s.hero.suit = ['gunRelay', 'spinShot']; s.offers = [['reclaim', 'kite', 'sniper']];
    expect(pickOffer(s)).toEqual({ kind: 'choose', i: 0 });
  });
  it('replaces kite in a full suit with momentum', () => {
    const s = arena().s; s.hero.suit = ['gunRelay', 'spinShot', 'reclaim', 'bladeRelay', 'flow', 'kite'];
    s.offers = [['momentum']];
    expect(pickOffer(s)).toEqual({ kind: 'choose', i: 0, slot: 5 });
  });
  it('rejects an element engraving without its round', () => {
    const s = arena().s; s.hero.rounds = [];
    expect(scoreCard(s, 'fireEmber')).toBe(0);
  });
});

describe('bot campaign', () => {
  it('is deterministic and carries settled resources into the next run', () => {
    const a = runCampaign(1000, 2), b = runCampaign(1000, 2);
    expect(a).toEqual(b);
    expect(a.runs).toHaveLength(2);
    expect(a.runs[0]!.metaSettled.energy).toBeGreaterThan(a.runs[0]!.metaStart.energy);
    expect(a.runs[1]!.metaStart).toEqual(a.runs[0]!.metaAfter);
    expect(a.runs[1]!.metaStart).not.toEqual(a.runs[0]!.metaStart);
    expect(a.runs.every(r => !r.repairs.includes('core'))).toBe(true);
  }, 60000);
});

describe('bot safety and decision contracts', () => {
  it('does not edit simulation state, including RNG state', () => {
    const sim = arena(); foe(sim, 10, 7); sim.s.hero.gear.active = 1;
    const before = JSON.stringify(sim.s, (_, v) => v instanceof Set ? [...v] : v);
    smartDecide(sim, createMemory());
    expect(JSON.stringify(sim.s, (_, v) => v instanceof Set ? [...v] : v)).toBe(before);
  });
  it('does not attack diagonally through a corner', () => {
    const sim = arena(); foe(sim, 8, 8); sim.s.map.tiles[idx(sim.s.map, { x: 8, y: 7 })] = 'wall';
    sim.s.hero.gear.active = 1; sim.s.hero.charge = 0;
    const a = smartDecide(sim, createMemory());
    expect(a).not.toMatchObject({ kind: 'move', dir: { x: 1, y: 1 } });
  });
  it('escapes a full mage mark in two steps instead of waiting in its centre', () => {
    const sim = arena(); mark(sim);
    sim.s.telegraphs[0]!.cells.push(...DIRS.map(d => add(sim.s.hero.pos, d)));
    const first = smartDecide(sim, createMemory()); expect(first.kind).toBe('move');
    if (first.kind !== 'move') return;
    sim.s.hero.pos = add(sim.s.hero.pos, first.dir);
    const second = smartDecide(sim, createMemory()); expect(second.kind).toBe('move');
    if (second.kind === 'move') expect(dangerCells(sim.s).has(idx(sim.s.map, add(sim.s.hero.pos, second.dir)))).toBe(false);
  });
  it('reports no shot chance and does not shoot through a wall', () => {
    const sim = arena(); const f = foe(sim, 10, 7, 8, 'archer');
    sim.s.map.tiles[idx(sim.s.map, { x: 9, y: 7 })] = 'wall';
    expect(sim.shotChance(f.id)).toBeNull();
    expect(smartDecide(sim, createMemory()).kind).not.toBe('shoot');
  });
  it('rests before entering visible adjacent stairs', () => {
    const sim = arena(); sim.s.map.stairs = { x: 8, y: 7 }; sim.s.hero.hp = 20;
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'wait' });
  });
  it('stops safe resting near the next wanderer wave above 60% HP', () => {
    const sim = arena(); sim.s.map.stairs = { x: 8, y: 7 }; sim.s.hero.hp = 25;
    sim.s.time = sim.s.run.floorStart + 140;
    expect(smartDecide(sim, createMemory())).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
  });
  it('loots a visible nearby chest before taking stairs', () => {
    const sim = arena(); sim.s.map.stairs = { x: 8, y: 7 };
    sim.s.chests.push({ pos: { x: 6, y: 7 }, opened: false });
    expect(smartDecide(sim, createMemory())).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
  });
  it('uses known haste once before engaging a newly seen champion', () => {
    const sim = arena(); foe(sim, 10, 7, 70, 'champion');
    sim.s.hero.gear.potions.haste = 2; sim.s.lore.known.push('potion:haste');
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'drink', p: 'haste' });
    sim.s.hero.buffs = { haste: 10 };
    expect(smartDecide(sim, createMemory()).kind).not.toBe('drink');
  });
  it('does not use unknown escape items by their hidden effect', () => {
    const sim = arena(); foe(sim, 8, 7); sim.s.hero.hp = 10; sim.s.hero.gear.belt.potion = 0;
    sim.s.hero.gear.scrolls.teleport = 1; sim.s.hero.gear.potions.invis = 1;
    expect(smartDecide(sim, createMemory()).kind).not.toBe('read');
    expect(smartDecide(sim, createMemory()).kind).not.toBe('drink');
    sim.s.lore.known.push('scroll:teleport');
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'read', sc: 'teleport' });
  });
  it('never reads a known lure in safe time', () => {
    const sim = arena(); sim.s.hero.gear.scrolls.lure = 1; sim.s.lore.known.push('scroll:lure');
    expect(smartDecide(sim, createMemory()).kind).not.toBe('read');
  });
  it('does not throw a blast onto the hero', () => {
    const sim = arena(); foe(sim, 8, 7); foe(sim, 8, 8);
    sim.s.hero.gear.potions.fire = 1; sim.s.lore.known.push('potion:fire');
    expect(smartDecide(sim, createMemory()).kind).not.toBe('throwPotion');
  });
  it('passes weak upgrades to a full suit and accepts rounds without replacing a slot', () => {
    const sim = arena(), s = sim.s;
    s.hero.suit = ['gunRelay', 'bladeRelay', 'reclaim', 'momentum', 'flow', 'bayonet'];
    s.offers = [['kite']]; expect(pickOffer(s)).toEqual({ kind: 'choose', i: null });
    s.offers = [[{ kind: 'round', element: 'fire' }]];
    expect(pickOffer(s)).toEqual({ kind: 'choose', i: 0 });
    sim.act(pickOffer(s)); expect(s.hero.rounds).toContain('fire'); expect(s.hero.suit).toHaveLength(6);
  });
});

it('remembers visible loot when a corner temporarily hides it', () => {
  const sim = arena(), mem = createMemory();
  sim.s.chests.push({ pos: { x: 10, y: 7 }, opened: false });
  const first = smartDecide(sim, mem);
  expect(first.kind).toBe('move');
  if (first.kind === 'move') sim.s.hero.pos = add(sim.s.hero.pos, first.dir);
  sim.s.visible.clear();
  expect(smartDecide(sim, mem)).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
});
it('keeps pursuing a remembered threat after a detour leaves the sensing radius', () => {
  const sim = arena(), mem = createMemory(); foe(sim, 10, 7);
  sim.s.hero.charge = 0;
  smartDecide(sim, mem);
  expect(mem.pursuit?.id).toBe('f0');
  sim.s.hero.pos = { x: 1, y: 1 }; sim.s.visible.clear();
  expect(['move', 'swap']).toContain(smartDecide(sim, mem).kind);
});

it('breaks movement cycles by committing to a reachable exit', () => {
  const sim = arena(), mem = createMemory();
  sim.s.map.stairs = { x: 11, y: 7 };
  sim.s.chests.push({ pos: { x: 3, y: 7 }, opened: false });
  // Revisit the same two positions without any discovery, loot or combat progress.
  for (let i = 0; i < 8; i++) {
    sim.s.hero.pos = { x: i % 2 ? 6 : 7, y: 7 };
    smartDecide(sim, mem);
  }
  sim.s.hero.pos = { x: 7, y: 7 };
  expect(smartDecide(sim, mem)).toMatchObject({ kind: 'move', dir: { x: 1, y: 0 } });
});

describe('bot stones and portals', () => {
  it('answers a stone prompt before combat, after upgrades and offers, without changing state', () => {
    const sim = arena(), s = sim.s; foe(sim, 8, 7); s.run.stones = ['soulCell']; s.stonePrompt = 'soulCell';
    s.hero.baseMods = { mag: 'extMag' };
    const before = JSON.stringify(s);
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'socket', stone: 'soulCell' }); expect(JSON.stringify(s)).toBe(before);
    s.upgrades = [['hp']]; expect(smartDecide(sim, createMemory()).kind).toBe('upgrade'); s.upgrades = [];
    s.offers = [['flow']]; expect(smartDecide(sim, createMemory()).kind).toBe('choose');
  });
  it('keeps a weaker stone and compares against the current socket', () => {
    const sim = arena(), s = sim.s; s.run.stones = ['elemChamber', 'soulCell']; s.stonePrompt = 'elemChamber';
    s.hero.sockets = { mag: 'soulCell' }; s.hero.baseMods = { mag: 'extMag' };
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'socket', stone: null });
  });
  it('opens missing campaign portals, but sockets guardians in single runs and after unlocking', () => {
    const sim = arena(), s = sim.s, m = freshMeta(); s.run.stones = ['guardian5']; s.stonePrompt = 'guardian5';
    expect(smartDecide(sim, createMemory(), m)).toEqual({ kind: 'portal', stone: 'guardian5' });
    expect(smartDecide(sim, createMemory())).toEqual({ kind: 'socket', stone: 'guardian5' });
    m.portals = [5]; expect(smartDecide(sim, createMemory(), m)).toEqual({ kind: 'socket', stone: 'guardian5' });
    s.hero.sockets = { heart: 'guardian5' }; expect(smartDecide(sim, createMemory(), m)).toEqual({ kind: 'socket', stone: null });
  });
  it('loots a nearby stone before descending', () => {
    const sim = arena(); sim.s.map.stairs = { x: 8, y: 7 };
    sim.s.floorItems.push({ pos: { x: 6, y: 7 }, item: { kind: 'stone', id: 'soulCell', name: '영혼 전지 마석' } });
    expect(smartDecide(sim, createMemory())).toMatchObject({ kind: 'move', dir: { x: -1, y: 0 } });
  });
  it('crafts and fits unlocked stone mods and equips an unlocked heart for campaigns', () => {
    const m = freshMeta(); m.materials = { scrap: 100, soul: 100, relic: 100, remains: 100 };
    m.mods.unlocked = ['soulCell', 'undyingHeart']; spendMeta(m, arena().s);
    expect(m.mods.fitted.mag).toBe('soulCell'); expect(m.mods.fitted.heart).toBe('undyingHeart'); expect(m.mods.owned).toContain('soulCell');
  });
  it('defaults to floor one and starts at the deepest authorized portal only when requested', () => {
    const m = freshMeta(); m.portals = [5, 10]; m.repairs = ['nav'];
    const base = { god: false, policy: 'smart' as const, meta: m, maxActions: 0 };
    expect(runBot(3, base).floor).toBe(1); expect(runBot(3, { ...base, startDeep: true }).floor).toBe(11);
    m.repairs = []; expect(runBot(3, { ...base, startDeep: true }).floor).toBe(1);
  });
});
it('reports stone inventories, portals and safe endings per run', () => {
  const r = runBot(3, { god: false, policy: 'smart', maxActions: 0 });
  expect(r).toMatchObject({ stonesFound: [], stonesSocketed: [], stonesBanked: [], portalsOpened: [], safeEnd: false });
});
