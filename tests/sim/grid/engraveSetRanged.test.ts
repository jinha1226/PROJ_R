import { expect, it } from 'vitest';
import { emit } from '../../../src/sim/grid/kataBus';
import { rangedAttack } from '../../../src/sim/grid/weapons';
import { OPEN, sim, sureHits } from './kit';

const setup = () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }, { kind: 'brute', pos: { x: 8, y: 7 } }]);
  sureHits(g); g.s.hero.suit = []; return g;
};
const hooks = { noise: () => {} };
it('quickdraw gains one charge on gun kill, not a hit', () => {
  const { s } = setup(); s.hero.suit = ['quickdraw']; s.hero.charge = 0;
  emit(s, 'gunHit', { t: 0 }); expect(s.fired.size).toBe(0);
  emit(s, 'gunKill', { t: 0 }); expect(s.hero.charge).toBe(1); expect(s.fired.has('quickdraw')).toBe(true);
});
it('pierce hits the foe immediately behind a living target for no extra charge, never an off-line foe', () => {
  const { s } = setup(); s.hero.suit = ['pierce']; const [a, b] = s.foes;
  b!.pos.y++; emit(s, 'gunHit', { t: 0, foe: a }); expect(s.fired.size).toBe(0);
  b!.pos.y--; s.hero.arrows = 2; rangedAttack(s, 0, a!, hooks);
  expect(b!.hp).toBeLessThan(b!.maxHp); expect(s.hero.arrows).toBe(0); expect(s.fired.has('pierce')).toBe(true);
});
it.each([['sniper', 1.5], ['headshot', 2], ['steady', 2]] as const)('%s boosts the current shot before damage and rejects its missing condition', (id, mult) => {
  const { s } = setup(); s.hero.suit = [id]; const foe = s.foes[0]!; s.foes[1]!.alive = false;
  foe.hp = foe.maxHp = 100;
  if (id === 'headshot') foe.hp--;
  emit(s, 'preShot', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.hp = foe.maxHp;
  if (id === 'sniper') foe.pos.x = 9;
  if (id === 'steady') s.hero.fx.lastAction = 'wait';
  const plain = setup(); plain.s.foes[0]!.pos = { ...foe.pos }; plain.s.foes[1]!.alive = false;
  rangedAttack(plain.s, 0, plain.s.foes[0]!, hooks);
  const base = plain.s.events.find(e => e.type === 'hit')!.amount!;
  rangedAttack(s, 0, foe, hooks);
  expect(s.events.find(e => e.type === 'hit')!.amount).toBe(Math.round(base * mult));
  expect(s.hero.fx.nextMult).toBe(1); expect(s.fired.has(id)).toBe(true);
});
it('covering banks a free shot on dodge only once', () => {
  const { s } = setup(); s.hero.suit = ['covering']; s.hero.fx.freeShot = true;
  emit(s, 'dodge', { t: 0 }); expect(s.fired.size).toBe(0);
  s.hero.fx.freeShot = false; emit(s, 'dodge', { t: 0 }); expect(s.hero.fx.freeShot).toBe(true); expect(s.fired.has('covering')).toBe(true);
});
it('suppress delays a living hit foe by half a turn, not a dead foe', () => {
  const { s } = setup(); s.hero.suit = ['suppress']; const foe = s.foes[0]!; const before = foe.nextAt;
  foe.alive = false; emit(s, 'gunHit', { t: 0, foe }); expect(s.fired.size).toBe(0);
  foe.alive = true; emit(s, 'gunHit', { t: 0, foe }); expect(foe.nextAt).toBe(before + 0.5); expect(s.fired.has('suppress')).toBe(true);
});
it('barrage shoots visible reachable foes for one charge each, stopping when empty', () => {
  const { s } = setup(); s.hero.suit = ['barrage']; s.foes[1]!.pos = { x: 5, y: 9 }; s.hero.arrows = 0;
  emit(s, 'chain', { t: 0 }); expect(s.fired.size).toBe(0);
  s.hero.arrows = 2; emit(s, 'chain', { t: 0 });
  expect(s.events.filter(e => e.type === 'shoot')).toHaveLength(2); expect(s.hero.arrows).toBe(0); expect(s.fired.has('barrage')).toBe(true);
});
it('thrift refunds the actual shot cost, not a full battery', () => {
  const { s } = setup(); s.hero.suit = ['thrift'];
  emit(s, 'gunKill', { t: 0, shotCost: 2 }); expect(s.fired.size).toBe(0);
  s.hero.charge = 0; emit(s, 'gunKill', { t: 0, shotCost: 2 }); expect(s.hero.charge).toBe(2); expect(s.fired.has('thrift')).toBe(true);
});
