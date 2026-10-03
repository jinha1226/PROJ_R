import { losClear } from './fov';
import type { BeltItem, Element } from './items';
import { applyElement, areaCells, entsAt, hurt } from './status';
import { dist, idx, same, type Cell, type GridState } from './types';

const BLAST: [number, number] = [6, 9];
const BOMB: [number, number] = [8, 12];
export const THROW_RANGE = 6;
const FLASK: Record<Exclude<BeltItem, 'potion' | 'bomb'>, { el: Element; dmg: [number, number] | null; radius: number }> = {
  fireFlask: { el: 'fire', dmg: [4, 7], radius: 1 },
  frostFlask: { el: 'frost', dmg: [3, 5], radius: 1 },
  shockFlask: { el: 'shock', dmg: [5, 8], radius: 0 },
  poisonFlask: { el: 'poison', dmg: null, radius: 1 },
};

/** Barrels going off, one after another: each explodes once (3×3 damage, fire on the floor), neighbours catch. */
export function explodeBarrels(s: GridState, t: number, first: Cell, src: string): void {
  const queue = [first];
  while (queue.length) {
    const c = queue.shift()!;
    const i = s.barrels.findIndex((b) => same(b, c));
    if (i < 0) continue;
    s.barrels.splice(i, 1);
    s.events.push({ t, type: 'explode', src, to: { ...c } });
    for (const cell of areaCells(s, c, 1)) for (const e of entsAt(s, cell)) hurt(s, t, src, e, s.rng.int(BLAST[0], BLAST[1]), 'fire');
    applyElement(s, t, 'fire', c, 1, null, src, (b) => queue.push(b));
    for (const b of s.barrels) if (dist(b, c) === 1) queue.push(b);
  }
}

/** Can the hero throw at that cell (seen, in range, nothing solid in the way — bodies are thrown over)? */
export function canThrow(s: GridState, at: Cell): boolean {
  return s.visible.has(idx(s.map, at)) && dist(s.hero.pos, at) <= THROW_RANGE && losClear(s.map, s.hero.pos, at);
}

/** A bomb or a flask thrown at a cell; null when it cannot be thrown or there is none. */
export function useThrown(s: GridState, t: number, item: Exclude<BeltItem, 'potion'>, at: Cell | undefined): number | null {
  const g = s.hero.gear;
  if (!at || g.belt[item] <= 0 || !canThrow(s, at)) return null;
  g.belt[item]--;
  s.events.push({ t, type: 'use', src: s.hero.id, to: { ...at }, text: item });
  const boom = (c: Cell) => explodeBarrels(s, t, c, s.hero.id);
  if (item === 'bomb') {
    s.events.push({ t, type: 'explode', src: s.hero.id, to: { ...at } });
    for (const cell of areaCells(s, at, 1)) {
      for (const e of entsAt(s, cell)) hurt(s, t, s.hero.id, e, s.rng.int(BOMB[0], BOMB[1]), 'blast');
      if (s.barrels.some((b) => same(b, cell))) boom(cell);
    }
  } else {
    const f = FLASK[item];
    applyElement(s, t, f.el, at, f.radius, f.dmg, s.hero.id, boom);
  }
  for (const e of [s.hero, ...s.foes]) if (e.alive && dist(e.pos, at) <= 1) e.awake = true;
  return 1;
}
