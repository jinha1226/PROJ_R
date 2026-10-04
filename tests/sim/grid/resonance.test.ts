import { expect, it } from 'vitest';
import { resonance, pistolCost } from '../../../src/sim/grid/resonance';
import { ENGRAVE_IDS, ENGRAVES } from '../../../src/sim/grid/engraveCore';
import { heroDmg, rangedAttack } from '../../../src/sim/grid/weapons';
import { addStatus, STATUS_TURNS } from '../../../src/sim/grid/status';
import { makeWeapon } from '../../../src/sim/grid/items';
import { DEFS } from '../../../src/sim/grid/engraveDefs';
import { OPEN, sim, sureHits } from './kit';

it.each(['melee', 'ranged', 'fusion', 'element'] as const)('%s counts only the current suit and updates after removal', family => {
  const { s } = sim(OPEN, { x: 5, y: 7 });
  const ids = ENGRAVE_IDS.filter(id => ENGRAVES[id].family === family);
  s.hero.suit = ids.slice(0, 2); s.records = ids; s.run.unlocked = ids; s.run.tasted = ids;
  expect(resonance(s)[family]).toBe(false);
  s.hero.suit.push(ids[2]!); expect(resonance(s)[family]).toBe(true);
  s.hero.suit.pop(); expect(resonance(s)[family]).toBe(false);
});
it('melee resonance adds one to both damage endpoints, never gun damage', () => {
  const { s } = sim(OPEN, { x: 5, y: 7 }); s.hero.suit = ['dash', 'finisher'];
  const sword = makeWeapon('sword', 1); const gun = makeWeapon('pistol', 1);
  const base = heroDmg(s, sword); const gunBase = heroDmg(s, gun);
  s.hero.suit.push('leap'); expect(heroDmg(s, sword)).toEqual(base.map(n => n + 1));
  expect(heroDmg(s, gun)).toEqual(gunBase);
  s.hero.suit.pop(); expect(heroDmg(s, sword)).toEqual(base);
});
it('pistol resonance reduces costs above one and never makes shots free', () => {
  const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]); sureHits(g);
  g.s.hero.suit = ['rapid', 'mark']; expect(pistolCost(g.s, 3)).toBe(3);
  g.s.hero.suit.push('ricochet'); expect(pistolCost(g.s, 3)).toBe(2); expect(pistolCost(g.s, 1)).toBe(1);
  rangedAttack(g.s, 0, g.s.foes[0]!, { noise: () => {} }); expect(g.s.hero.charge).toBe(9);
});
it.each(['fire', 'frost', 'poison'] as const)('element resonance extends hero %s only', el => {
  const { s } = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
  const f = s.foes[0]!; const key = el === 'fire' ? 'burn' : el === 'frost' ? 'freeze' : 'poison';
  for (const n of [2, 3, 2]) {
    s.hero.suit = ['alternate', 'echo', 'chain'].slice(0, n) as typeof s.hero.suit;
    f.status = undefined; addStatus(s, 0, f, el, s.hero.id);
    expect(f.status?.[key]).toBe(STATUS_TURNS[key] + Number(n === 3));
    f.status = undefined; addStatus(s, 0, f, el, 'mage'); expect(f.status?.[key]).toBe(STATUS_TURNS[key]);
  }
});
it('fusion resonance lowers the chain threshold to two and updates after removal', () => {
  const old = DEFS.counterShot; const oldExecute = DEFS.execute;
  try {
    DEFS.counterShot = { on: 'afterWait', effect: 'shield', p: 1 };
    DEFS.execute = { on: 'afterWait', effect: 'shield', p: 1 };
    const g = sim(OPEN, { x: 5, y: 7 }); g.s.hero.suit = ['counterShot', 'execute'];
    expect(g.act({ kind: 'wait' }).some(e => e.type === 'chain')).toBe(false);
    g.s.hero.suit.push('flow'); expect(g.act({ kind: 'wait' }).find(e => e.type === 'chain')?.amount).toBe(2);
    expect(g.s.hero.fx.free).toBe(true);
    g.s.hero.suit.pop(); expect(g.act({ kind: 'wait' }).some(e => e.type === 'chain')).toBe(false);
  } finally { DEFS.counterShot = old; DEFS.execute = oldExecute; }
});
