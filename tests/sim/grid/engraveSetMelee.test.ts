import { expect, it } from 'vitest';
import { emit } from '../../../src/sim/grid/kataBus';
import { meleeAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const setup = () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }, { kind: 'brute', pos: { x: 5, y: 6 } }]);
  sureHits(g); g.s.hero.gear.active = 1; g.s.hero.suit = []; return g;
};
it('bloodlust heals two on a melee kill, not at full health', () => {
  const { s } = setup(); s.hero.suit = ['bloodlust'];
  emit(s, 'meleeKill', { t: 0 }); expect(s.fired.size).toBe(0);
  s.hero.hp -= 4; emit(s, 'meleeKill', { t: 0 }); expect(s.hero.hp).toBe(s.hero.maxHp - 2);
  expect(s.fired.has('bloodlust')).toBe(true);
});
it('fury banks 1.5 on a melee kill, never downgrades a larger boost', () => {
  const { s } = setup(); s.hero.suit = ['fury']; s.hero.fx.nextMult = 2;
  emit(s, 'meleeKill', { t: 0 }); expect(s.fired.size).toBe(0);
  s.hero.fx.nextMult = 1; emit(s, 'meleeKill', { t: 0 }); expect(s.hero.fx.nextMult).toBe(1.5);
  expect(s.fired.has('fury')).toBe(true);
});
it('shoulder pushes only after a move', () => {
  const { s } = setup(); s.hero.suit = ['shoulder']; const foe = s.foes[0]!;
  emit(s, 'meleeHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  s.hero.fx.lastAction = 'move'; emit(s, 'meleeHit', { t: 0, foe });
  expect(foe.pos.x).toBe(7); expect(s.fired.has('shoulder')).toBe(true);
});
it('ironwall grants three shield on parry, not dodge', () => {
  const { s } = setup(); s.hero.suit = ['ironwall'];
  emit(s, 'dodge', { t: 0 }); expect(s.fired.size).toBe(0);
  emit(s, 'parry', { t: 0 }); expect(s.hero.shield).toBe(3); expect(s.fired.has('ironwall')).toBe(true);
});
it('cull kills a foe at 30 percent without a pistol or charge, never a champion', () => {
  const { s } = setup(); s.hero.suit = ['cull']; s.hero.gear.hands[0] = null; s.hero.charge = 0;
  const foe = s.foes[0]!; foe.hp = foe.maxHp * 0.3; foe.kind = 'champion';
  emit(s, 'meleeHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.kind = 'brute'; emit(s, 'meleeHit', { t: 0, foe }); expect(foe.alive).toBe(false);
  expect(s.hero.charge).toBe(0); expect(s.fired.has('cull')).toBe(true);
});
it('tempest slashes every adjacent foe once after the main blow, not a lone foe', () => {
  const g = setup(), { s } = g; s.hero.suit = ['tempest']; const [a, b] = s.foes;
  b!.alive = false; meleeAttack(s, 0, { x: 1, y: 0 }, a!); expect(s.fired.size).toBe(0);
  b!.alive = true; a!.hp = a!.maxHp = 100; b!.hp = b!.maxHp = 100; s.events = [];
  meleeAttack(s, 0, { x: 1, y: 0 }, a!);
  expect(s.events.filter(e => e.type === 'hit' && e.dst === a!.id)).toHaveLength(2);
  expect(s.events.filter(e => e.type === 'hit' && e.dst === b!.id)).toHaveLength(1);
  expect(s.fired.has('tempest')).toBe(true);
});
it('gale needs two melee kills in the action', () => {
  const { s } = setup(); s.hero.suit = ['gale'];
  emit(s, 'meleeKill', { t: 0, count: 1 }); expect(s.fired.size).toBe(0);
  emit(s, 'meleeKill', { t: 0, count: 2 }); expect(s.hero.fx.free).toBe(true); expect(s.fired.has('gale')).toBe(true);
});
it('rebound gains two charge only from a slam stun', () => {
  const { s } = setup(); s.hero.suit = ['rebound']; s.hero.charge = 0;
  emit(s, 'stunned', { t: 0, src: 'riposte' }); expect(s.fired.size).toBe(0);
  emit(s, 'stunned', { t: 0, src: 'slam' }); expect(s.hero.charge).toBe(2); expect(s.fired.has('rebound')).toBe(true);
});
