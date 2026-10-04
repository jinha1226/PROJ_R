import { describe, expect, it } from 'vitest';
import { attackChoice } from '../../src/ui/grid/attackChoice';
import { makeWeapon, type WeaponGroup } from '../../src/sim/grid/items';
import { idx } from '../../src/sim/grid/types';
import { OPEN, sim } from '../sim/grid/kit';

const state = (...positions: { x: number; y: number }[]) => sim(OPEN, { x: 3, y: 3 }, positions.map(pos => ({ kind: 'minion', pos }))).s;

describe('attackChoice', () => {
  it.each<WeaponGroup | null>(['pistol', 'sword', null])('melees with %s even when a farther foe is targeted', group => {
    const s = state({ x: 4, y: 3 }, { x: 6, y: 3 });
    s.hero.gear.hands = [group ? makeWeapon(group, 1) : null, null];
    expect(attackChoice(s, s.foes[1]!.id)).toEqual({ kind: 'melee', action: { kind: 'move', dir: { x: 1, y: 0 } }, foe: s.foes[0]!.id });
  });

  it('prefers the adjacent target, falling back to the hero target', () => {
    const s = state({ x: 4, y: 3 }, { x: 3, y: 2 });
    s.hero.target = s.foes[1]!.id;
    for (const target of [s.hero.target, undefined]) {
      expect(attackChoice(s, target)).toEqual({ kind: 'melee', action: { kind: 'move', dir: { x: 0, y: -1 } }, foe: s.hero.target });
    }
    expect(attackChoice(s, 'missing')).toMatchObject({ foe: s.foes[0]!.id });
  });

  it('shoots a diagonal foe behind a wall corner instead of meleeing', () => {
    const s = state({ x: 4, y: 4 });
    s.map.tiles[idx(s.map, { x: 4, y: 3 })] = 'wall';
    expect(attackChoice(s, s.foes[0]!.id)).toEqual({ kind: 'shoot', action: { kind: 'shoot', target: s.foes[0]!.id }, foe: s.foes[0]!.id });
  });

  it('shoots a target three cells away', () => {
    const s = state({ x: 6, y: 3 });
    expect(attackChoice(s, s.foes[0]!.id)).toEqual({ kind: 'shoot', action: { kind: 'shoot', target: s.foes[0]!.id }, foe: s.foes[0]!.id });
    expect(attackChoice(s, undefined)).toBeNull();
  });

  it.each<WeaponGroup | null>(['sword', null])('swaps %s only when the other hand is ranged', group => {
    const s = state({ x: 6, y: 3 });
    s.hero.gear.hands = [group ? makeWeapon(group, 1) : null, makeWeapon('pistol', 1)];
    expect(attackChoice(s, s.foes[0]!.id)).toEqual({ kind: 'swap' });
    s.hero.gear.hands[1] = null;
    expect(attackChoice(s, s.foes[0]!.id)).toBeNull();
  });

  it('ignores dead and invisible foes and does not mutate state', () => {
    const s = state({ x: 4, y: 3 }, { x: 3, y: 2 });
    s.foes[0]!.alive = false;
    s.visible.delete(idx(s.map, s.foes[1]!.pos));
    const before = JSON.stringify(s);
    expect(attackChoice(s, s.foes[1]!.id)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });
});
