import { expect, it } from 'vitest';
import { OPEN, sim, sureHits } from './kit';

it.each(['minion', 'brute'] as const)('records a killing %s blow and elite status', (kind) => {
  const g = sim(OPEN, { x: 2, y: 2 }, [{ kind, pos: { x: 3, y: 2 } }]);
  sureHits(g); g.s.rng.chance = (p) => p > 0.5; g.s.hero.hp = 1; g.s.foes[0]!.elite = kind === 'brute';
  g.act({ kind: 'wait' });
  expect(g.s.run.killedBy).toEqual(kind === 'brute' ? { kind, elite: true } : { kind });
});
it.each(['burn', 'poison'] as const)('records lethal %s', (kind) => {
  const g = sim(OPEN, { x: 2, y: 2 }); g.s.hero.hp = 1;
  g.s.hero.status = { burn: 0, freeze: 0, poison: 0, [kind]: 2 };
  g.act({ kind: 'wait' }); expect(g.s.run.killedBy).toEqual({ kind });
});
it('records a lethal trap', () => {
  const g = sim(OPEN, { x: 2, y: 2 }); g.s.hero.hp = 1;
  g.s.traps.push({ pos: { x: 3, y: 2 }, kind: 'spike', found: false });
  g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(g.s.run.killedBy).toEqual({ kind: 'trap' });
});
it('records a self-triggered barrel blast', () => {
  const g = sim(OPEN, { x: 2, y: 2 }); g.s.hero.hp = 1;
  g.s.barrels.push({ x: 3, y: 2 });
  g.act({ kind: 'move', dir: { x: 1, y: 0 } });
  expect(g.s.run.killedBy).toEqual({ kind: 'blast' });
});
