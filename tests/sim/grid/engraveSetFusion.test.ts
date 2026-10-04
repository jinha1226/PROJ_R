import { expect, it } from 'vitest';
import { emit } from '../../../src/sim/grid/kataBus';
import { OPEN, sim, sureHits } from './kit';
const setup = () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
  sureHits(g); g.s.hero.suit = []; return g;
};
it('bayonet shoots the same living foe for one charge, not with an empty battery', () => {
  const { s } = setup(); s.hero.gear.active = 1; s.hero.suit = ['bayonet']; s.hero.charge = 0; const foe = s.foes[0]!;
  emit(s, 'meleeHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  s.hero.charge = 1; emit(s, 'meleeHit', { t: 0, foe });
  expect(foe.hp).toBeLessThan(foe.maxHp); expect(s.hero.charge).toBe(0); expect(s.hero.gear.active).toBe(1); expect(s.fired.has('bayonet')).toBe(true);
});
it('reverseCut uses the offhand blade only against an adjacent living foe', () => {
  const { s } = setup(); s.hero.suit = ['reverseCut']; const foe = s.foes[0]!;
  foe.pos.x++; emit(s, 'gunHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.pos.x--; emit(s, 'gunHit', { t: 0, foe });
  expect(foe.hp).toBeLessThan(foe.maxHp); expect(s.hero.gear.active).toBe(0); expect(s.fired.has('reverseCut')).toBe(true);
});
it('reclaim adds one charge on a melee kill, not a gun kill', () => {
  const { s } = setup(); s.hero.suit = ['reclaim']; s.hero.charge = 0;
  emit(s, 'gunKill', { t: 0 }); expect(s.fired.size).toBe(0);
  emit(s, 'meleeKill', { t: 0 }); expect(s.hero.charge).toBe(1); expect(s.fired.has('reclaim')).toBe(true);
});
it('muzzleShove pushes a gun bash target, not a blade target', () => {
  const { s } = setup(); s.hero.suit = ['muzzleShove']; const foe = s.foes[0]!;
  emit(s, 'meleeHit', { t: 0, foe, src: 'blade' }); expect(s.fired.size).toBe(0);
  emit(s, 'meleeHit', { t: 0, foe, src: 'bash' }); expect(foe.pos.x).toBe(7); expect(s.fired.has('muzzleShove')).toBe(true);
});
it('executionRush resolves after execute regardless of suit order, never without execution', () => {
  const { s } = setup(); s.hero.suit = ['executionRush']; s.hero.charge = 3; const foe = s.foes[0]!;
  emit(s, 'stunned', { t: 0, foe }); expect(s.fired.size).toBe(0);
  s.hero.suit.push('execute'); emit(s, 'stunned', { t: 0, foe });
  expect(foe.alive).toBe(false); expect(s.hero.charge).toBe(4); expect(s.fired.has('executionRush')).toBe(true);
});
it('trance heals three on a chain with both kill kinds, not melee alone', () => {
  const { s } = setup(); s.hero.suit = ['trance']; s.hero.hp -= 5;
  s.hero.fx.kills = { melee: ['a'], gun: [] }; emit(s, 'chain', { t: 0 }); expect(s.fired.size).toBe(0);
  s.hero.fx.kills.gun.push('b'); emit(s, 'chain', { t: 0 });
  expect(s.hero.hp).toBe(s.hero.maxHp - 2); expect(s.fired.has('trance')).toBe(true);
});
