import { describe, expect, it } from 'vitest';
import { mouseClickChoice, mouseHoverTarget } from '../../src/ui/grid/mouseAim';
import { makeWeapon } from '../../src/sim/grid/items';
import { idx } from '../../src/sim/grid/types';
import { OPEN, sim } from '../sim/grid/kit';

const near = { x: 4, y: 3 }, far = { x: 6, y: 3 };
const state = () => sim(OPEN, { x: 3, y: 3 }, [near, far].map(pos => ({ kind: 'minion', pos }))).s;

describe('mouse aim decisions', () => {
  it('hovers visible living foes without mutating state', () => {
    const s = state();
    const before = JSON.stringify(s);
    expect(mouseHoverTarget(s, far)).toBe(s.foes[1]!.id);
    expect(mouseHoverTarget(s, { x: 2, y: 2 })).toBeUndefined();
    expect(mouseHoverTarget(s, null)).toBeUndefined();
    expect(JSON.stringify(s)).toBe(before);
    s.foes[0]!.alive = false;
    s.visible.delete(idx(s.map, far));
    expect(mouseHoverTarget(s, near)).toBeUndefined();
    expect(mouseHoverTarget(s, far)).toBeUndefined();
  });

  it('melees a clicked adjacent foe', () => {
    const s = state();
    expect(mouseClickChoice(s, near)).toEqual({ kind: 'melee', action: { kind: 'move', dir: { x: 1, y: 0 } }, foe: s.foes[0]!.id });
  });

  it('uses the same adjacent priority even when clicking a distant foe', () => {
    const s = state();
    expect(mouseClickChoice(s, far)).toMatchObject({ kind: 'melee', foe: s.foes[0]!.id });
  });

  it('shoots a clicked distant foe when no foe is adjacent', () => {
    const s = state();
    s.foes[0]!.alive = false;
    expect(mouseClickChoice(s, far)).toEqual({ kind: 'shoot', action: { kind: 'shoot', target: s.foes[1]!.id }, foe: s.foes[1]!.id });
  });

  it('targets without swapping when holding a sword', () => {
    const s = state();
    s.foes[0]!.alive = false;
    s.hero.gear.hands = [makeWeapon('sword', 1), makeWeapon('pistol', 1)];
    expect(mouseClickChoice(s, far)).toEqual({ kind: 'target', foe: s.foes[1]!.id });
  });

  it('keeps an unshootable foe targeted and leaves floor taps to walking', () => {
    const s = state();
    s.foes[0]!.alive = false;
    s.map.tiles[idx(s.map, { x: 5, y: 3 })] = 'wall';
    expect(mouseClickChoice(s, far)).toEqual({ kind: 'target', foe: s.foes[1]!.id });
    expect(mouseClickChoice(s, { x: 2, y: 2 })).toEqual({ kind: 'walk' });
    expect(mouseClickChoice(s, null)).toBeNull();
  });
});
