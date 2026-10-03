import { canThrow, THROW_RANGE } from '../../sim/grid/explosives';
import type { BeltItem } from '../../sim/grid/items';
import type { PotionKind } from '../../sim/grid/lore';

/** Something thrown at a cell: a bomb or flask from the belt, or a potion from the pack. */
export type ThrowItem = Exclude<BeltItem, 'potion'> | `potion:${PotionKind}`;
import { areaCells } from '../../sim/grid/status';
import { add, DIRS, dist, idx, type Cell, type GridState } from '../../sim/grid/types';

/** Aiming a throw: a reticle cell that moves by direction or by tapping; shows the blast and whether it can land. */
export class GridAim {
  cell: Cell;

  constructor(private readonly s: GridState, readonly item: ThrowItem) {
    const foes = s.foes.filter((f) => f.alive && s.visible.has(idx(s.map, f.pos)) && dist(f.pos, s.hero.pos) <= THROW_RANGE)
      .sort((a, b) => dist(a.pos, s.hero.pos) - dist(b.pos, s.hero.pos));
    // nearest foe in reach, else the first spot three cells out that a throw could land on (never your own feet)
    const out = DIRS.map((d) => ({ x: s.hero.pos.x + d.x * 3, y: s.hero.pos.y + d.y * 3 })).find((c) => canThrow(s, c));
    this.cell = foes[0] ? { ...foes[0].pos } : out ?? add(s.hero.pos, { x: 0, y: -1 });
  }

  move(d: Cell): void {
    const n = add(this.cell, d);
    if (dist(n, this.s.hero.pos) <= THROW_RANGE) this.cell = n;
  }

  /** Tapping a cell: the first tap moves the reticle there, a second tap on it means "throw". */
  tap(c: Cell): boolean {
    if (c.x === this.cell.x && c.y === this.cell.y) return true;
    this.cell = { ...c };
    return false;
  }

  get ok(): boolean {
    return canThrow(this.s, this.cell);
  }

  /** The cells the throw would cover. */
  area(): Cell[] {
    return areaCells(this.s, this.cell, this.item === 'shockFlask' ? 0 : 1);
  }
}
