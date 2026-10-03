import { describe, it, expect } from 'vitest';
import { packRows } from '../../src/ui/grid/packPanel';
import { newState } from '../../src/sim/grid/state';
import { handMap } from '../sim/grid/kit';

const MAP = ['#####', '#...#', '#####'];

describe('potions and scrolls in the bag', () => {
  it('lists what you carry with its colour or rune until known, then its name; empty stacks are left out', () => {
    const s = newState(handMap(MAP), 5);
    s.hero.gear.potions = { haste: 2, cure: 0 };
    s.hero.gear.scrolls = { map: 1 };
    const rows = packRows(s);
    expect(rows.map((r) => [r.kind, r.id, r.n])).toEqual([['potion', 'haste', 2], ['scroll', 'map', 1]]);
    expect(rows[0]!.name).toBe(`${s.lore.colors.haste} 물약`);
    expect(rows[0]!.known).toBe(false);
    s.lore.known.push('potion:haste');
    expect(packRows(s)[0]!.name).toBe('신속 물약');
  });
});
