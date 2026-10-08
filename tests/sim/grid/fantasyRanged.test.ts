import { expect, it } from 'vitest';
import { createRng } from '../../../src/core/rng';
import { shootable } from '../../../src/sim/grid/actions';
import { makeWeapon, rollEquipment } from '../../../src/sim/grid/items';
import { regenerate } from '../../../src/sim/grid/regen';
import { fromSave, toSave } from '../../../src/sim/grid/save';
import { canFire, rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';
const arena = (seed = 3) => sim(OPEN, { x: 7, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }], seed);
const hooks = { noise() {} };
it('starts with a bow, a dagger and 24 arrows', () => {
  const h = arena().s.hero;
  expect(h.gear.hands.map(w => w?.group)).toEqual(['bow', 'dagger']);
  expect(h.gear.hands[1]?.name).toBe('단검'); expect(h.arrows).toBe(24);
});
it('spends arrows instead of mana and exposes no empty-quiver targets', () => {
  const g = arena(), s = g.s; s.hero.charge = 0;
  expect(rangedAttack(s, 0, s.foes[0]!, hooks)).toBe(1);
  expect(s.hero.arrows).toBe(23); expect(s.hero.charge).toBe(0);
  s.hero.arrows = 0;
  expect(canFire(s)).toBe(false); expect(shootable(s)).toEqual([]);
  expect(g.shotChance(s.foes[0]!.id)).toBeNull();
  expect(rangedAttack(s, 0, s.foes[0]!, hooks)).toBeNull();
});
it('staff shots spend two mana and its element overrides imbued rounds', () => {
  const g = arena(), s = g.s; sureHits(g);
  s.hero.gear.hands[0] = { ...makeWeapon('staff', 2), element: 'frost' };
  s.hero.rounds = ['fire']; s.foes[0]!.hp = 100;
  rangedAttack(s, 0, s.foes[0]!, hooks);
  expect(s.hero.charge).toBe(8); expect(s.foes[0]!.status?.freeze).toBeGreaterThan(0);
  expect(s.foes[0]!.status?.burn ?? 0).toBe(0);
  s.hero.charge = 1; expect(shootable(s)).toEqual([]); expect(g.shotChance(s.foes[0]!.id)).toBeNull();
});
it('mana regenerates in combat, retaining fractional time and respecting the cap', () => {
  const s = arena().s; s.hero.charge = 0;
  regenerate(s, 1, false); expect(s.hero.charge).toBe(0);
  regenerate(s, 0.5, false); expect(s.hero.charge).toBe(1);
  regenerate(s, 30, false); expect(s.hero.charge).toBe(s.hero.maxCharge);
});
it('a seeded hit leaves a recoverable arrow, picked up by walking and capped at 40', () => {
  let found = false;
  for (let seed = 1; seed < 100 && !found; seed++) {
    const g = arena(seed), s = g.s;
    rangedAttack(s, 0, s.foes[0]!, hooks);
    if (!s.events.some(e => e.type === 'hit') || !s.floorItems.some(f => f.item.kind === 'arrows')) continue;
    found = true; s.foes = []; s.hero.arrows = 39;
    s.floorItems.push({ pos: { x: 9, y: 7 }, item: { kind: 'arrows', n: 10 } });
    g.act({ kind: 'move', dir: { x: 1, y: 0 } }); g.act({ kind: 'move', dir: { x: 1, y: 0 } });
    expect(s.hero.arrows).toBe(40);
  }
  expect(found).toBe(true);
});
it('gunRelay fires the bow in the other hand after a blade kill', () => {
  const g = arena(); sureHits(g); const s = g.s;
  s.hero.gear.active = 1; s.hero.suit = ['gunRelay'];
  s.foes.push({ ...s.foes[0]!, id: 'close', pos: { x: 8, y: 7 }, hp: 1 });
  const ev = g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(ev.some(e => e.type === 'shoot' && e.group === 'bow')).toBe(true);
  expect(s.hero.arrows).toBe(23);
});
it('old pistols migrate to tier-one bows with a default quiver', () => {
  const data = JSON.parse(toSave(arena().s));
  data.state.hero.gear.hands[0] = { kind: 'weapon', group: 'pistol', tier: 2, name: '권총' };
  delete data.state.hero.arrows;
  const h = fromSave(JSON.stringify(data)).hero;
  expect(h.gear.hands[0]).toEqual(makeWeapon('bow', 1)); expect(h.arrows).toBe(24);
});
it('loot includes tiered bows and elemental staves with 60/20/20 weights', () => {
  const rng = createRng(12), counts = { melee: 0, bow: 0, staff: 0 };
  const tiers = new Set<number>();
  for (let i = 0; i < 5000; i++) {
    const w = rollEquipment(rng, 3);
    if (w.group === 'bow' || w.group === 'staff') { counts[w.group]++; tiers.add(w.tier); }
    else counts.melee++;
    if (w.group === 'staff') expect(['fire', 'frost', 'shock', 'poison']).toContain(w.element);
  }
  expect(counts.melee / 5000).toBeCloseTo(0.6, 1);
  expect(counts.bow / 5000).toBeCloseTo(0.2, 1); expect(counts.staff / 5000).toBeCloseTo(0.2, 1);
  expect([...tiers].sort()).toEqual([1, 2]);
});
it('thrift still fires on a bow kill and refunds the spent arrow', () => {
  const g = arena(); sureHits(g); const s = g.s;
  s.hero.suit = ['thrift']; s.foes[0]!.hp = 1;
  rangedAttack(s, 0, s.foes[0]!, hooks);
  expect(s.fired.has('thrift')).toBe(true); expect(s.hero.arrows).toBe(24);
});
