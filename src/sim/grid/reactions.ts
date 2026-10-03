import type { Element } from './items';
import { dist, same, type Cell, type Ent, type GridState } from './types';

const IGNITE: [number, number] = [4, 7];
const STEAM_TURNS = 3;

/** Who and what an element's reaction needs (kept free of status.ts so both can call each other's helpers). */
export interface ReactionKit {
  hurt(s: GridState, t: number, src: string, dst: Ent, amount: number, text?: string): void;
  ents(s: GridState, c: Cell): Ent[];
  area(s: GridState, at: Cell, radius: number): Cell[];
}

function react(s: GridState, t: number, kind: string, at: Cell, src: string): void {
  s.events.push({ t, type: 'react', src, to: { ...at }, text: kind });
}

/** Poison set alight: a blast around it that also burns the poison and the clouds away. */
export function ignite(s: GridState, t: number, at: Cell, src: string, k: ReactionKit): void {
  react(s, t, 'ignite', at, src);
  const cells = k.area(s, at, 1);
  for (const c of cells) for (const e of k.ents(s, c)) {
    if (e.status) e.status.poison = 0;
    k.hurt(s, t, src, e, s.rng.int(IGNITE[0], IGNITE[1]), 'fire');
  }
  s.tiles = s.tiles.filter((x) => !(x.kind === 'poison' && dist(x.pos, at) <= 1));
}

/** Fire meets ice: steam fills the area (blocks sight and shots), burning and freezing stop. */
export function steam(s: GridState, t: number, at: Cell, src: string, k: ReactionKit): void {
  react(s, t, 'steam', at, src);
  for (const c of k.area(s, at, 1)) {
    for (const e of k.ents(s, c)) if (e.status) { e.status.burn = 0; e.status.freeze = 0; }
    s.tiles = s.tiles.filter((x) => !same(x.pos, c));
    s.tiles.push({ pos: { ...c }, kind: 'steam', until: s.time + STEAM_TURNS });
  }
}

/**
 * Checks an element landing on an entity for a reaction. Returns what happened (so the caller skips the
 * plain effect) or null. Lightning reactions (shatter, paralyse) are handled by the caller from the returned kind.
 */
export function reactOn(s: GridState, t: number, el: Element, e: Ent, src: string, k: ReactionKit): 'ignite' | 'steam' | 'shatter' | 'paralyse' | null {
  const st = e.status;
  if (!st) return null;
  if (el === 'fire' && st.poison > 0) { ignite(s, t, e.pos, src, k); return 'ignite'; }
  if (el === 'fire' && st.freeze > 0) { steam(s, t, e.pos, src, k); return 'steam'; }
  if (el === 'frost' && st.burn > 0) { steam(s, t, e.pos, src, k); return 'steam'; }
  if (el === 'shock' && st.freeze > 0) { st.freeze = 0; react(s, t, 'shatter', e.pos, src); return 'shatter'; }
  if (el === 'shock' && st.poison > 0) { e.stun = Math.max(e.stun ?? 0, 2); react(s, t, 'paralyse', e.pos, src); return 'paralyse'; }
  return null;
}

/** Elements landing on the ground: fire on a poison cloud ignites it, frost on burning ground makes steam. */
export function reactOnTile(s: GridState, t: number, el: Element, c: Cell, src: string, k: ReactionKit): boolean {
  const tile = s.tiles.find((x) => same(x.pos, c) && x.until > s.time);
  if (!tile) return false;
  if (el === 'fire' && tile.kind === 'poison') { ignite(s, t, c, src, k); return true; }
  if (el === 'frost' && tile.kind === 'fire') { steam(s, t, c, src, k); return true; }
  return false;
}
