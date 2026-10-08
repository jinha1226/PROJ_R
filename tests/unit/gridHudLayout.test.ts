import { describe, expect, it } from 'vitest';
import { newState } from '../../src/sim/grid/state';
import { makeWeapon } from '../../src/sim/grid/items';
import { idx } from '../../src/sim/grid/types';
import { handMap, OPEN } from '../sim/grid/kit';
import { intentOf } from '../../src/ui/grid/intent';
import { pushLog, visibleLog } from '../../src/ui/grid/hudLog';
import { suitTiles } from '../../src/ui/grid/suitTiles';

function state() {
  const map = handMap(OPEN);
  map.spawns = [{ kind: 'archer', pos: { x: 5, y: 1 }, group: 1 }];
  const s = newState(map, 3);
  s.foes[0]!.awake = true;
  s.visible.add(idx(map, s.foes[0]!.pos));
  return s;
}

describe('target intent', () => {
  it('shows only this foe’s telegraph, with whirl taking priority', () => {
    const s = state(), f = s.foes[0]!;
    s.telegraphs.push({ src: 'other', kind: 'whirl', center: f.pos, cells: [], dmg: [1, 2], at: 2 });
    expect(intentOf(s, f)).toBe('조준 중');
    s.telegraphs.push({ ...s.telegraphs[0]!, src: f.id, kind: 'spell' });
    expect(intentOf(s, f)).toBe('주문 준비');
    s.telegraphs.push({ ...s.telegraphs[0]!, src: f.id });
    expect(intentOf(s, f)).toBe('회전 베기 준비');
  });
  it('shows sleeping and otherwise leaves ordinary foes blank', () => {
    const s = state(), f = s.foes[0]!;
    f.awake = false;
    expect(intentOf(s, f)).toBe('잠듦');
    f.awake = true; f.kind = 'minion';
    expect(intentOf(s, f)).toBe('');
    f.alive = false;
    expect(intentOf(s, f)).toBe('');
  });
  it('requires visibility, range, a clear shot and a non-invisible hero', () => {
    for (const block of ['visibility', 'range', 'wall', 'invis'] as const) {
      const s = state(), f = s.foes[0]!;
      expect(intentOf(s, f)).toBe('조준 중');
      if (block === 'visibility') s.visible.clear();
      if (block === 'range') f.pos.x = 12;
      if (block === 'wall') s.map.tiles[idx(s.map, { x: 3, y: 1 })] = 'wall';
      if (block === 'invis') s.hero.buffs = { invis: 100 };
      expect(intentOf(s, f)).toBe('');
    }
  });
});

describe('HUD log', () => {
  it('keeps three newest lines without mutating its input, including repeated messages', () => {
    const first = pushLog([], '하나', 0);
    const lines = pushLog(pushLog(pushLog(first, '둘', 1), '둘', 2), '경고', 3, true);
    expect(first.map((l) => l.text)).toEqual(['하나']);
    expect(lines.map((l) => l.text)).toEqual(['경고', '둘', '둘']);
    expect(lines[0]!.warn).toBe(true);
  });
  it('expires each line at four seconds and prunes on insertion', () => {
    const lines = pushLog(pushLog([], '이전', 0), '최근', 2);
    expect(visibleLog(lines, 3.999)).toHaveLength(2);
    expect(visibleLog(lines, 4).map((l) => l.text)).toEqual(['최근']);
    expect(visibleLog(lines, 6)).toEqual([]);
    expect(pushLog(lines, '새 소식', 7)).toHaveLength(1);
  });
});

describe('suit tiles', () => {
  it('always supplies six ordered slots with dim empty slots', () => {
    const s = state(); s.hero.suit = ['rapid'];
    const tiles = suitTiles(s);
    expect(tiles).toHaveLength(6);
    expect(tiles[0]).toEqual({ id: 'rapid', name: '연사', lit: true });
    expect(tiles.slice(1)).toEqual(Array(5).fill({ id: null, name: '빈 슬롯', lit: false }));
    expect(s.hero.suit).toEqual(['rapid']);
  });
  it('updates melee, ranged, element and universal fits with the active hand', () => {
    const s = state(); s.hero.suit = ['dash', 'rapid', 'chain', 'momentum'];
    for (const [group, expected] of [
      ['sword', [true, false, true, true]],
      ['bow', [false, true, true, true]],
    ] as const) {
      s.hero.gear.hands[1] = makeWeapon(group, 1); s.hero.gear.active = 1;
      expect(suitTiles(s).slice(0, 4).map((t) => t.lit)).toEqual(expected);
    }
    s.hero.gear.hands[1] = null;
    expect(suitTiles(s).slice(0, 4).map((t) => t.lit)).toEqual([false, false, true, true]);
  });
});
