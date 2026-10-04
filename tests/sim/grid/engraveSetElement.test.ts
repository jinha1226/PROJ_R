import { expect, it } from 'vitest';
import { ENGRAVES, type EngraveId } from '../../../src/sim/grid/engraveCore';
import { emit } from '../../../src/sim/grid/kataBus';
import { addStatus, applyElement, tickStatuses } from '../../../src/sim/grid/status';
import { meleeAttack, rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const setup = (id: EngraveId) => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }, { kind: 'brute', pos: { x: 7, y: 7 } }]);
  sureHits(g); g.s.hero.suit = [id];
  g.s.foes.forEach(f => { f.hp = f.maxHp = 100; f.status = { burn: 0, freeze: 0, poison: 0 }; });
  return g;
};
const hooks = { noise: () => {} };
it.each(['fireSpread', 'poisonBurst'] as const)('%s spreads from a corpse for either kill type, only with status', id => {
  for (const trigger of ['meleeKill', 'gunKill'] as const) {
    const { s } = setup(id), [a, b] = s.foes;
    a!.alive = false; emit(s, trigger, { t: 0, foe: a }); expect(s.fired.size).toBe(0);
    const key = id === 'fireSpread' ? 'burn' : 'poison'; a!.status![key] = 3;
    emit(s, trigger, { t: 0, foe: a }); expect(b!.status![key]).toBeGreaterThan(0);
    expect(s.fired.has(id)).toBe(true);
    if (id === 'poisonBurst') expect(s.tiles.some(x => x.kind === 'poison')).toBe(true);
  }
});
it.each([['fireBlade', 'burn', 1.5], ['frostShatter', 'freeze', 2], ['frostBite', 'freeze', 1.3]] as const)('%s boosts the actual hit only with status', (id, key, mult) => {
  const { s } = setup(id), foe = s.foes[0]!;
  const gun = id === 'frostBite'; s.hero.gear.active = gun ? 0 : 1;
  emit(s, gun ? 'preShot' : 'preMelee', { t: 0, foe }); expect(s.fired.size).toBe(0);
  const attack = () => gun ? rangedAttack(s, 0, foe, hooks) : meleeAttack(s, 0, { x: 1, y: 0 }, foe);
  attack(); const base = s.events.find(e => e.type === 'hit')!.amount!; s.events = [];
  foe.status![key] = 2; attack();
  expect(s.events.find(e => e.type === 'hit')!.amount).toBe(Math.round(base * mult));
  expect(s.fired.has(id)).toBe(true); expect(s.hero.fx.nextMult).toBe(1);
  if (id === 'frostShatter') expect(foe.status!.freeze).toBe(0);
});
it('fireStoke boosts every enemy burn tick, with one pop, never hero burn', () => {
  const { s } = setup('fireStoke'), [a, b] = s.foes;
  tickStatuses(s, a!, 0); expect(s.fired.size).toBe(0);
  for (const f of [a!, b!, s.hero]) { f.status = { burn: 2, freeze: 0, poison: 0 }; const hp = f.hp;
    tickStatuses(s, f, 0); expect(hp - f.hp).toBe(f === s.hero ? 2 : 3); }
  expect(s.events.filter(e => e.type === 'engrave')).toHaveLength(1);
});
it('fireEmber restores one charge only for a burning gun kill', () => {
  const { s } = setup('fireEmber'), foe = s.foes[0]!; s.hero.charge = 0;
  emit(s, 'gunKill', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.status!.burn = 1; emit(s, 'meleeKill', { t: 0, foe }); expect(s.fired.size).toBe(0);
  emit(s, 'gunKill', { t: 0, foe }); expect(s.hero.charge).toBe(1);
});
it('frostVeil grants two shield only for hero frost', () => {
  const { s } = setup('frostVeil'), foe = s.foes[0]!;
  addStatus(s, 0, foe, 'frost', 'enemy'); addStatus(s, 0, foe, 'fire', s.hero.id); expect(s.fired.size).toBe(0);
  addStatus(s, 0, foe, 'frost', s.hero.id); expect(s.hero.shield).toBe(2);
});
it('frostSnap freezes only adjacent foes, caps champions, and needs a target', () => {
  const { s } = setup('frostSnap'), [a, b] = s.foes; a!.alive = false;
  emit(s, 'chain', { t: 0 }); expect(s.fired.size).toBe(0);
  a!.alive = true; a!.kind = 'champion'; s.hero.suit.push('fireStoke', 'poisonSiphon'); emit(s, 'chain', { t: 0 });
  expect(a!.status!.freeze).toBe(1); expect(b!.status!.freeze).toBe(0); expect(s.hero.status?.freeze ?? 0).toBe(0);
});
it('shockArc jumps once to an adjacent foe, never without one or for other elements', () => {
  const { s } = setup('shockArc'), [a, b] = s.foes;
  emit(s, 'elementApplied', { t: 0, foe: a, element: 'fire' }); expect(s.fired.size).toBe(0);
  b!.alive = false; emit(s, 'elementApplied', { t: 0, foe: a, element: 'shock' }); expect(s.fired.size).toBe(0);
  b!.alive = true; applyElement(s, 0, 'shock', a!.pos, 0, null, s.hero.id);
  expect(b!.hp).toBeLessThan(98); expect(s.events.filter(e => e.type === 'engrave' && e.text === 'shockArc')).toHaveLength(1);
});
it('shockCharge gains one only for hero shock and stops at capacity', () => {
  const { s } = setup('shockCharge'), foe = s.foes[0]!;
  addStatus(s, 0, foe, 'shock', s.hero.id); expect(s.fired.size).toBe(0);
  s.hero.charge = 0; addStatus(s, 0, foe, 'fire', s.hero.id); expect(s.fired.size).toBe(0);
  addStatus(s, 0, foe, 'shock', s.hero.id); expect(s.hero.charge).toBe(1);
});
it('shockCut needs owned shock rounds, including the unloaded second round', () => {
  const { s } = setup('shockCut'), foe = s.foes[0]!;
  emit(s, 'meleeHit', { t: 0, foe, src: 'blade' }); expect(s.fired.size).toBe(0);
  s.hero.rounds = ['fire', 'shock']; emit(s, 'meleeHit', { t: 0, foe, src: 'blade' });
  expect(foe.hp).toBe(96); expect(s.fired.has('shockCut')).toBe(true);
});
it('shockDischarge hits around the hero on dodge, never parry or the hero', () => {
  const { s } = setup('shockDischarge'), foe = s.foes[0]!;
  emit(s, 'parry', { t: 0, foe }); expect(s.fired.size).toBe(0);
  const hp = s.hero.hp; emit(s, 'dodge', { t: 0, foe });
  expect(foe.hp).toBeLessThan(100); expect(s.hero.hp).toBe(hp); expect(s.fired.has('shockDischarge')).toBe(true);
});
it('poisonVenom doubles existing poison once, only on a blade hit', () => {
  const { s } = setup('poisonVenom'), foe = s.foes[0]!;
  emit(s, 'meleeHit', { t: 0, foe, src: 'blade' }); expect(s.fired.size).toBe(0);
  foe.status!.poison = 5; emit(s, 'meleeHit', { t: 0, foe, src: 'bash' }); expect(s.fired.size).toBe(0);
  emit(s, 'meleeHit', { t: 0, foe, src: 'blade' }); emit(s, 'meleeHit', { t: 0, foe, src: 'blade' });
  expect(foe.status!.poison).toBe(10); expect(s.fired.has('poisonVenom')).toBe(true);
});
it.each(['brute', 'champion'] as const)('poisonParalyze extends poison stun with a champion cap: %s', kind => {
  const { s } = setup('poisonParalyze'), foe = s.foes[0]!; foe.kind = kind; foe.stun = 1;
  emit(s, 'stunned', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.status!.poison = 3; emit(s, 'stunned', { t: 0, foe });
  expect(foe.stun).toBe(kind === 'champion' ? 1 : 2);
  expect(s.events.filter(e => e.type === 'engrave')).toHaveLength(1);
});
it('poisonSiphon heals once per time turn and action, including lethal ticks, never hero poison', () => {
  const { s } = setup('poisonSiphon'), [a, b] = s.foes; s.hero.hp -= 5;
  tickStatuses(s, a!, 0); expect(s.fired.size).toBe(0);
  a!.status!.poison = b!.status!.poison = 4; a!.hp = 1;
  tickStatuses(s, a!, 0); expect(s.hero.hp).toBe(s.hero.maxHp - 4);
  s.fired.clear(); tickStatuses(s, b!, 0.5); expect(s.hero.hp).toBe(s.hero.maxHp - 4);
  tickStatuses(s, b!, 1); expect(s.hero.hp).toBe(s.hero.maxHp - 3);
  s.fired.clear(); s.hero.status = { burn: 0, freeze: 0, poison: 1 }; tickStatuses(s, s.hero, 2);
  expect(s.hero.hp).toBe(s.hero.maxHp - 4); expect(s.fired.size).toBe(0);
});
it('all sixteen entries are unlockable any-hand element engravings with element tags', () => {
  const ids = ['fireSpread', 'fireBlade', 'fireStoke', 'fireEmber', 'frostShatter', 'frostVeil', 'frostBite', 'frostSnap',
    'shockArc', 'shockCharge', 'shockCut', 'shockDischarge', 'poisonBurst', 'poisonVenom', 'poisonParalyze', 'poisonSiphon'] as const;
  const names = ['화염', '빙결', '전격', '독'];
  const costs = [70, 60, 50, 50, 90, 60, 50, 90, 70, 60, 60, 80, 70, 60, 70, 60];
  ids.forEach((id, i) => expect(ENGRAVES[id]).toMatchObject({ fits: 'any', family: 'element', base: true, cost: costs[i], tags: expect.arrayContaining([names[Math.floor(i / 4)]]) }));
});
it.each(['fireSpread', 'poisonBurst'] as const)('%s leaves ground even without a surviving neighbour', id => {
  const { s } = setup(id), foe = s.foes[0]!; s.foes.forEach(f => { f.alive = false; });
  foe.status![id === 'fireSpread' ? 'burn' : 'poison'] = 2;
  emit(s, 'gunKill', { t: 0, foe });
  expect(s.fired.has(id)).toBe(true); expect(s.tiles.length).toBeGreaterThan(0);
});
it('frostShatter leaves freeze on a miss and consumes its boost without leaking into the next attack', () => {
  const g = setup('frostShatter'), { s } = g, foe = s.foes[0]!;
  s.hero.gear.active = 1; foe.status!.freeze = 2; s.rng.chance = () => false;
  meleeAttack(s, 0, { x: 1, y: 0 }, foe);
  expect(s.fired.has('frostShatter')).toBe(true); expect(foe.status!.freeze).toBe(2); expect(s.hero.fx.nextMult).toBe(1);
});
it('frostShatter thaws after a hit even with an already stronger banked multiplier', () => {
  const { s } = setup('frostShatter'), foe = s.foes[0]!; s.hero.gear.active = 1;
  foe.status!.freeze = 2; s.hero.fx.nextMult = 3; meleeAttack(s, 0, { x: 1, y: 0 }, foe);
  expect(foe.status!.freeze).toBe(0); expect(s.fired.has('frostShatter')).toBe(true);
});
it('a fireBlade axe sweep boosts only the burning target', () => {
  const { s } = setup('fireBlade'), [a, b] = s.foes; s.hero.gear.active = 1;
  s.hero.gear.hands[1]!.group = 'axe'; b!.pos = { x: 6, y: 8 }; a!.status!.burn = 2;
  meleeAttack(s, 0, { x: 1, y: 0 }, a!);
  const hits = s.events.filter(e => e.type === 'hit');
  expect(hits[0]!.amount).toBe(Math.round(hits[1]!.amount! * 1.5));
});
it('shockCut and poisonParalyze cannot stun a champion above one turn even with element resonance', () => {
  const { s } = setup('shockCut'), foe = s.foes[0]!;
  s.hero.suit = ['shockCut', 'poisonParalyze', 'shockCharge']; s.hero.rounds = ['shock'];
  foe.kind = 'champion'; foe.status!.poison = 3;
  emit(s, 'meleeHit', { t: 0, foe, src: 'blade' }); expect(foe.stun).toBe(1);
  expect(s.events.filter(e => e.type === 'engrave' && e.text === 'poisonParalyze')).toHaveLength(1);
});
it.each(['fireSpread', 'poisonBurst'] as const)('%s works through actual melee and gun kill dispatch', id => {
  for (const gun of [false, true]) {
    const { s } = setup(id), [a, b] = s.foes; s.hero.gear.active = gun ? 0 : 1;
    a!.hp = 1; a!.status![id === 'fireSpread' ? 'burn' : 'poison'] = 2;
    if (gun) rangedAttack(s, 0, a!, hooks); else meleeAttack(s, 0, { x: 1, y: 0 }, a!);
    expect(a!.alive).toBe(false); expect(b!.status![id === 'fireSpread' ? 'burn' : 'poison']).toBeGreaterThan(0);
    expect(s.events.filter(e => e.type === 'engrave' && e.text === id)).toHaveLength(1);
  }
});
it('preMelee and poisonVenom also cover counter blade hits', async () => {
  const { counterBlow } = await import('../../../src/sim/grid/combos');
  const { s } = setup('frostShatter'), foe = s.foes[0]!;
  s.hero.gear.active = 1; s.hero.suit = ['counter', 'frostShatter', 'poisonVenom'];
  foe.status!.freeze = 2; foe.status!.poison = 5; counterBlow(s, 0, foe.id, 'dodge');
  expect(foe.status!.freeze).toBe(0); expect(foe.status!.poison).toBe(10);
});
it('preMelee covers a leap hit', async () => {
  const { lunge } = await import('../../../src/sim/grid/combos');
  const { s } = setup('frostShatter'), foe = s.foes[0]!;
  s.hero.gear.active = 1; s.hero.suit = ['leap', 'frostShatter'];
  foe.pos.x = 8; s.foes[1]!.alive = false; foe.status!.freeze = 2;
  lunge(s, 0, { x: 1, y: 0 }, hooks); expect(foe.status!.freeze).toBe(0);
});
it('a bash gains its C2 pre-hit boost without spending an existing blade boost', () => {
  const { s } = setup('fireBlade'), foe = s.foes[0]!;
  s.hero.fx.nextMult = 2; foe.status!.burn = 2;
  meleeAttack(s, 0, { x: 1, y: 0 }, foe);
  expect(s.fired.has('fireBlade')).toBe(true); expect(s.hero.fx.nextMult).toBe(2);
});
