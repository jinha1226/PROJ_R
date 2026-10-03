import { describe, it, expect } from 'vitest';
import { makeWeapon, type WeaponGroup } from '../../../src/sim/grid/items';
import type { EngraveId } from '../../../src/sim/grid/engraveCore';
import type { GridSim } from '../../../src/sim/grid/gridSim';
import { OPEN, sim, sureHits } from './kit';

/** Hand 1 gets `group` with the given engravings; hand 2 optionally another weapon. */
const arm = (g: GridSim, group: WeaponGroup, ids: EngraveId[], other?: WeaponGroup, otherIds: EngraveId[] = [], el?: 'fire' | 'frost' | 'shock' | 'poison') => {
  const w = makeWeapon(group, 1, el);
  w.engraves = ids.map((id) => ({ id, lvl: 1 }));
  g.s.hero.gear.hands[0] = w;
  if (other) { const o = makeWeapon(other, 1); o.engraves = otherIds.map((id) => ({ id, lvl: 1 })); g.s.hero.gear.hands[1] = o; }
  g.s.hero.gear.active = 0;
  g.s.hero.gear.arrows = 30;
};
const fired = (evs: { type: string; text?: string }[], id: string) => evs.filter((e) => e.type === 'engrave' && e.text === id).length;
const R = { x: 1, y: 0 };

describe('melee combo engravings', () => {
  it('dash: a foe two cells ahead is struck by leaping one cell in', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    sureHits(g);
    arm(g, 'sword', ['dash']);
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(fired(ev, 'dash')).toBe(1);
    expect(g.s.hero.pos).toEqual({ x: 6, y: 7 });
    expect(g.s.foes[0]!.hp).toBeLessThan(99);
  });

  it('without the engraving the same move just walks', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 7, y: 7 } }]);
    arm(g, 'sword', []);
    g.s.foes[0]!.hp = 99;
    g.act({ kind: 'move', dir: R });
    expect(g.s.foes[0]!.hp).toBe(99);
  });

  it('finisher: the third blow in a row on the same foe hits harder and shoves', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'sword', ['finisher']);
    g.s.foes[0]!.hp = 99;
    g.s.foes[0]!.stun = 99;
    g.act({ kind: 'move', dir: R });
    g.act({ kind: 'move', dir: R });
    const ev = g.act({ kind: 'move', dir: R });
    expect(fired(ev, 'finisher')).toBe(1);
    expect(ev.some((e) => e.type === 'push')).toBe(true);
  });

  it('shove-shot: a blow shoves the foe away and the ranged weapon in the other hand fires', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'sword', ['shoveShot'], 'crossbow');
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(fired(ev, 'shoveShot')).toBe(1);
    expect(ev.some((e) => e.type === 'shoot' && e.src === 'hero')).toBe(true);
    expect(g.s.hero.gear.active).toBe(0);
  });

  it('leap: a foe three cells ahead — jump two cells and strike all around the landing', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }, { kind: 'brute', pos: { x: 6, y: 8 } }]);
    sureHits(g);
    arm(g, 'axe', ['leap']);
    for (const f of g.s.foes) f.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(fired(ev, 'leap')).toBe(1);
    expect(g.s.hero.pos).toEqual({ x: 5, y: 7 });
    expect(g.s.foes.every((f) => f.hp < 99)).toBe(true);
  });

  it('counter and riposte: a weave or a parry is answered with a blow', () => {
    for (const [id, bar, ev] of [['counter', 0.15, 'dodge'], ['riposte', 0.11, 'parry']] as const) {
      const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
      arm(g, id === 'counter' ? 'dagger' : 'sword', [id]);
      g.s.hero.gear.armor = null;
      g.s.foes[0]!.hp = 99;
      g.s.rng = { next: () => 0, int: (a: number) => a, chance: (p: number) => p >= bar, pick: <T>(arr: readonly T[]) => arr[0]!, shuffle: <T>(arr: T[]) => arr, getState: () => 0 };
      const out = g.act({ kind: 'wait' });
      expect(out.some((e) => e.type === ev)).toBe(true);
      expect(fired(out, id)).toBeGreaterThan(0);
      expect(g.s.foes[0]!.hp).toBeLessThan(99);
    }
  });
});

describe('general engravings', () => {
  it('momentum: a kill halves the next action', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'sword', ['momentum']);
    g.s.foes[0]!.hp = 1;
    expect(fired(g.act({ kind: 'move', dir: R }), 'momentum')).toBe(1);
    const t = g.s.time;
    g.act({ kind: 'wait' });
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('quickswap: swapping to the engraved weapon is free and its next blow +50%', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'crossbow', [], 'sword', ['quickswap']);
    const t = g.s.time;
    expect(fired(g.act({ kind: 'swap' }), 'quickswap')).toBe(1);
    expect(g.s.time).toBe(t);
    g.s.foes[0]!.hp = 99;
    const hit = g.act({ kind: 'move', dir: R }).find((e) => e.type === 'hit' && e.src === 'hero')!;
    expect(hit.amount).toBeGreaterThanOrEqual(Math.round(6 * 1.2 * 1.5) - 1);
  });

  it('swap-strike: swapping to the engraved weapon strikes at once', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'crossbow', [], 'sword', ['swapstrike']);
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'swap' });
    expect(fired(ev, 'swapstrike')).toBe(1);
    expect(g.s.foes[0]!.hp).toBeLessThan(99);
  });

  it('wall-slam: slamming a foe into a wall sends a shockwave to its neighbours', () => {
    const g = sim(OPEN, { x: 12, y: 7 }, [{ kind: 'brute', pos: { x: 13, y: 7 } }, { kind: 'brute', pos: { x: 13, y: 8 } }]);
    sureHits(g);
    arm(g, 'mace', ['wallslam']);
    for (const f of g.s.foes) f.hp = 99;
    const ev = g.act({ kind: 'move', dir: R });
    expect(fired(ev, 'wallslam')).toBe(1);
    expect(g.s.foes[1]!.hp).toBeLessThan(99);
  });

  it('last stand: below 30% health blows hit 40% harder', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'sword', ['laststand']);
    g.s.foes[0]!.hp = 99;
    g.s.hero.hp = 5;
    const hit = g.act({ kind: 'move', dir: R }).find((e) => e.type === 'hit' && e.src === 'hero')!;
    expect(hit.amount).toBe(Math.round(Math.round(6 * 1.2) * 1.4));
  });
});

describe('ranged and magic engravings', () => {
  it('rapid: the second shot at the same foe is quicker, the third is a crit', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 9, y: 7 } }]);
    sureHits(g);
    arm(g, 'bow', ['rapid']);
    const f = g.s.foes[0]!;
    f.hp = 999;
    f.stun = 99;
    g.act({ kind: 'shoot', target: f.id });
    const t = g.s.time;
    g.act({ kind: 'shoot', target: f.id });
    expect(g.s.time - t).toBeCloseTo(0.7);
    const third = g.act({ kind: 'shoot', target: f.id });
    expect(fired(third, 'rapid')).toBeGreaterThan(0);
    expect(third.find((e) => e.type === 'hit' && e.src === 'hero')!.crit).toBe(true);
  });

  it('mark: a marked foe takes more from everything, the mark moves on when it dies', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'minion', pos: { x: 7, y: 7 } }, { kind: 'brute', pos: { x: 9, y: 9 } }]);
    sureHits(g);
    arm(g, 'bow', ['mark']);
    const [a, b] = g.s.foes;
    a!.hp = 4;
    g.act({ kind: 'shoot', target: a!.id });
    expect(a!.alive).toBe(false);
    expect(b!.marked).toBe(true);
  });

  it('ricochet: a killing shot bounces to a foe within 3 cells', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'minion', pos: { x: 7, y: 7 } }, { kind: 'brute', pos: { x: 9, y: 7 } }]);
    sureHits(g);
    arm(g, 'bow', ['ricochet']);
    g.s.foes[0]!.hp = 1;
    g.s.foes[1]!.hp = 99;
    const ev = g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(fired(ev, 'ricochet')).toBe(1);
    expect(g.s.foes[1]!.hp).toBeLessThan(99);
  });

  it('kite: shooting a foe at arm\'s length rolls you a step back', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'brute', pos: { x: 6, y: 7 } }]);
    sureHits(g);
    arm(g, 'bow', ['kite']);
    g.s.foes[0]!.hp = 99;
    const ev = g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(fired(ev, 'kite')).toBe(1);
    expect(g.s.hero.pos).toEqual({ x: 4, y: 7 });
  });

  it('volley: every third shot also hits two more foes', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }, { kind: 'brute', pos: { x: 8, y: 9 } }, { kind: 'brute', pos: { x: 8, y: 5 } }]);
    sureHits(g);
    arm(g, 'bow', ['volley']);
    for (const f of g.s.foes) { f.hp = 99; f.stun = 99; }
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(fired(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }), 'volley')).toBe(1);
    expect(g.s.foes[1]!.hp).toBeLessThan(99);
    expect(g.s.foes[2]!.hp).toBeLessThan(99);
  });

  it('alternate: a different element than last time hits harder and takes half the time', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    arm(g, 'staff', ['alternate'], 'staff', ['alternate'], 'fire');
    g.s.hero.gear.hands[1] = Object.assign(makeWeapon('staff', 1, 'frost'), { engraves: [{ id: 'alternate' as const, lvl: 1 as const }] });
    g.s.foes[0]!.hp = 999;
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    g.act({ kind: 'swap' });
    const t = g.s.time;
    expect(fired(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }), 'alternate')).toBe(1);
    expect(g.s.time - t).toBeCloseTo(0.5);
  });

  it('echo: every third spell goes off twice', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    arm(g, 'staff', ['echo'], undefined, [], 'frost');
    g.s.hero.gear.hands[0]!.charges = 9;
    g.s.foes[0]!.hp = 999;
    for (let i = 0; i < 2; i++) g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(fired(g.act({ kind: 'shoot', target: g.s.foes[0]!.id }), 'echo')).toBe(1);
  });

  it('chain lightning jumps twice', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }, { kind: 'brute', pos: { x: 9, y: 7 } }, { kind: 'brute', pos: { x: 10, y: 7 } }]);
    sureHits(g);
    arm(g, 'staff', ['chain'], undefined, [], 'shock');
    for (const f of g.s.foes) f.hp = 99;
    g.act({ kind: 'shoot', target: g.s.foes[0]!.id });
    expect(g.s.foes[2]!.hp).toBeLessThan(99);
  });

  it('elemental arrow: the last spell\'s element rides on the next arrow', () => {
    const g = sim(OPEN, { x: 3, y: 7 }, [{ kind: 'brute', pos: { x: 8, y: 7 } }]);
    sureHits(g);
    arm(g, 'staff', ['elemArrow'], 'bow', [], 'fire');
    const f = g.s.foes[0]!;
    f.hp = 999;
    g.act({ kind: 'shoot', target: f.id });
    f.status = { burn: 0, freeze: 0, poison: 0 };
    g.act({ kind: 'swap' });
    const ev = g.act({ kind: 'shoot', target: f.id });
    expect(fired(ev, 'elemArrow')).toBe(1);
    expect(f.status!.burn).toBeGreaterThan(0);
  });
});

describe('engraving guards', () => {
  it('an engraving fires at most once per action', () => {
    const g = sim(OPEN, { x: 5, y: 7 }, [{ kind: 'minion', pos: { x: 6, y: 7 } }, { kind: 'minion', pos: { x: 6, y: 6 } }, { kind: 'minion', pos: { x: 6, y: 8 } }]);
    sureHits(g);
    arm(g, 'axe', ['momentum']);
    for (const f of g.s.foes) f.hp = 1;
    expect(fired(g.act({ kind: 'move', dir: R }), 'momentum')).toBe(1);
  });
});
