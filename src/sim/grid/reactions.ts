import { fire, has } from './engraveCore';
import { losClear } from './fov';
import { emit } from './kataBus';
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
  if (src === s.hero.id) emit(s, 'reaction', { t, src, foe: s.foes.find(f => same(f.pos, at)) });
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
  spreadReaction(s, t, at, src, next => ignite(s, t, next.pos, src, k));
}

/** Fire meets ice: steam fills the area (blocks sight and shots), burning and freezing stop. */
export function steam(s: GridState, t: number, at: Cell, src: string, k: ReactionKit): void {
  react(s, t, 'steam', at, src);
  for (const c of k.area(s, at, 1)) {
    for (const e of k.ents(s, c)) if (e.status) { e.status.burn = 0; e.status.freeze = 0; }
    s.tiles = s.tiles.filter((x) => !same(x.pos, c));
    s.tiles.push({ pos: { ...c }, kind: 'steam', until: s.time + STEAM_TURNS });
  }
  spreadReaction(s, t, at, src, next => steam(s, t, next.pos, src, k));
}

/**
 * Checks an element landing on an entity for a reaction. Returns what happened (so the caller skips the
 * plain effect) or null. Lightning reactions (shatter, paralyse) are handled by the caller from the returned kind.
 */
export function reactOn(s: GridState, t: number, el: Element, e: Ent, src: string, k: ReactionKit, engraving = false): 'ignite' | 'steam' | 'shatter' | 'paralyse' | null {
  const st = e.status;
  if (!st) return null;
  if (el === 'fire' && st.poison > 0) { ignite(s, t, e.pos, src, k); return 'ignite'; }
  if (el === 'fire' && st.freeze > 0) { steam(s, t, e.pos, src, k); return 'steam'; }
  if (el === 'frost' && st.burn > 0) { steam(s, t, e.pos, src, k); return 'steam'; }
  if (el === 'shock' && st.freeze > 0) { st.freeze = 0; react(s, t, 'shatter', e.pos, src); return 'shatter'; }
  if (el === 'shock' && st.poison > 0) {
    e.stun = Math.min(engraving && e.kind === 'champion' ? 1 : Infinity, Math.max(e.stun ?? 0, 2));
    react(s, t, 'paralyse', e.pos, src);
    if (src === s.hero.id) emit(s, 'stunned', { t, src: 'reaction', foe: e, element: el });
    return 'paralyse';
  }
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

/** Repeat once on the first adjacent living foe in stable entity order. */
export function spreadReaction(s: GridState, t: number, at: Cell, src: string, repeat: (foe: Ent) => void): void {
  if (src !== s.hero.id || !has(s, 'chain')) return;
  const next = s.foes.find(f => f.alive && dist(f.pos, at) === 1 && losClear(s.map, at, f.pos));
  if (next && fire(s, t, 'chain')) repeat(next);
}

export function spreadShock(s: GridState, t: number, at: Cell, src: string, kind: 'shatter' | 'paralyse', amount: number, k: ReactionKit): void {
  spreadReaction(s, t, at, src, foe => {
    if (kind === 'paralyse') foe.stun = Math.min(foe.kind === 'champion' ? 1 : Infinity, Math.max(foe.stun ?? 0, 2));
    if (kind === 'shatter' && foe.status) foe.status.freeze = 0;
    react(s, t, kind, foe.pos, src);
    k.hurt(s, t, src, foe, kind === 'shatter' ? amount * 2 : amount, 'shock');
    if (kind === 'paralyse') emit(s, 'stunned', { t, src: 'reaction', foe, element: 'shock' });
  });
}
