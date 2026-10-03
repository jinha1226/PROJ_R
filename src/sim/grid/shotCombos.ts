import { freeCell, shotClear, strike } from './combat';
import { fire, has } from './engraveCore';
import { buffOn } from './buffs';
import { losClear } from './fov';
import type { Weapon } from './items';
import { applyElement, hurt, onEnter } from './status';
import { canStep, dist, idx, same, type Cell, type Ent, type GridState } from './types';

const RAPID_TIME = 0.7;
const RAPID_CRIT = 2;
const RICOCHET_RANGE = 3;
const RICOCHET_CHANCE = 0.5;
const VOLLEY_EVERY = 3;
const VOLLEY_SHOTS = 2;
const VOLLEY_MULT = 0.7;
const MARK_PASS = 6;
const ALT_MULT = 1.5;
const ALT_TIME = 0.5;
const ECHO_EVERY = 3;
const CHAIN_HOPS = 2;
const CHAIN_REACH = 2;

const byDistTo = (c: Cell) => (a: Ent, b: Ent) => dist(a.pos, c) - dist(b.pos, c);

/** Rapid fire: shots in a row at the same foe come quicker, every third is a crit. */
export function rapidStep(s: GridState, t: number, foe: Ent): { mult: number; time: number } {
  if (!has(s, 'rapid')) return { mult: 1, time: 1 };
  const r = s.hero.fx.rapid;
  r.n = r.target === foe.id ? r.n + 1 : 1;
  r.target = foe.id;
  if (r.n < 2) return { mult: 1, time: 1 };
  fire(s, t, 'rapid');
  return { mult: r.n % 3 === 0 ? RAPID_CRIT : 1, time: RAPID_TIME };
}

/** What a gunshot sets off: an element riding on it, a mark, a bounce, a volley, a step back. */
export function afterShot(s: GridState, t: number, foe: Ent, hit: boolean, dmg: readonly [number, number], chanceAt: (from: Cell, to: Cell) => number, range: number): void {
  const h = s.hero;
  const fx = h.fx;
  if (fx.arrowEl) {
    const el = fx.arrowEl;
    fx.arrowEl = undefined;
    if (hit && fire(s, t, 'elemArrow')) applyElement(s, t, el, foe.pos, 0, null, h.id, undefined, h.id);
  }
  if (hit && has(s, 'mark')) { foe.marked = true; fire(s, t, 'mark'); }
  if (hit && !foe.alive && has(s, 'ricochet') && s.rng.chance(RICOCHET_CHANCE)) {
    const next = s.foes.filter((f) => f.alive && dist(f.pos, foe.pos) <= RICOCHET_RANGE && shotClear(s, foe.pos, f.pos)).sort(byDistTo(foe.pos))[0];
    if (next && fire(s, t, 'ricochet')) {
      s.events.push({ t, type: 'shoot', src: h.id, dst: next.id, from: { ...foe.pos }, to: { ...next.pos }, text: 'ricochet' });
      next.awake = true;
      strike(s, t, h, next, chanceAt(foe.pos, next.pos), dmg);
    }
  }
  if (has(s, 'volley') && ++fx.shots % VOLLEY_EVERY === 0) {
    const more = s.foes.filter((f) => f !== foe && f.alive && s.visible.has(idx(s.map, f.pos)) && dist(h.pos, f.pos) <= range && shotClear(s, h.pos, f.pos))
      .sort(byDistTo(h.pos)).slice(0, VOLLEY_SHOTS);
    if (more.length && fire(s, t, 'volley')) for (const f of more) {
      s.events.push({ t, type: 'shoot', src: h.id, dst: f.id, from: { ...h.pos }, to: { ...f.pos }, text: 'volley' });
      f.awake = true;
      strike(s, t, h, f, chanceAt(h.pos, f.pos), dmg, VOLLEY_MULT);
    }
  }
  if (foe.alive && dist(h.pos, foe.pos) === 1 && has(s, 'kite')) {
    const back = { x: -Math.sign(foe.pos.x - h.pos.x), y: -Math.sign(foe.pos.y - h.pos.y) };
    const to = { x: h.pos.x + back.x, y: h.pos.y + back.y };
    // never onto the stairs or a trap the hero knows of, and not out of a net
    const safe = !(s.map.stairs && same(to, s.map.stairs)) && !s.traps.some((tr) => tr.found && same(tr.pos, to)) && !buffOn(h, 'root', t);
    if (canStep(s.map, h.pos, back) && freeCell(s, to) && safe && fire(s, t, 'kite')) {
      s.events.push({ t, type: 'move', src: h.id, from: { ...h.pos }, to: { ...to }, text: 'kite' });
      h.pos = to;
      onEnter(s, h, t);
    }
  }
}

/** A dead foe's mark jumps to the nearest living foe close by. */
export function passMarks(s: GridState, t: number): void {
  for (const dead of s.foes) {
    if (dead.alive || !dead.marked) continue;
    dead.marked = false;
    const next = s.foes.filter((f) => f.alive && !f.marked && dist(f.pos, dead.pos) <= MARK_PASS).sort(byDistTo(dead.pos))[0];
    if (next) { next.marked = true; s.events.push({ t, type: 'engrave', src: s.hero.id, dst: next.id, text: 'mark', to: { ...next.pos } }); }
  }
}

/**
 * A staff spell with its engravings: alternating elements hit harder and faster, every third spell echoes,
 * lightning chains, the element is kept for an elemental bullet. Returns the time factor for the cast.
 */
export function castSpell(s: GridState, w: Weapon, at: Cell, base: readonly [number, number], onBarrel: (c: Cell) => void): number {
  const h = s.hero;
  const fx = h.fx;
  const t = h.nextAt;
  const el = w.element ?? 'fire';
  let k = fx.nextMult;
  let time = 1;
  fx.nextMult = 1;
  if (fx.lastEl && fx.lastEl !== el && has(s, 'alternate') && fire(s, t, 'alternate')) { k *= ALT_MULT; time = ALT_TIME; }
  fx.lastEl = el;
  if (has(s, 'elemArrow')) fx.arrowEl = el;
  const dmg: [number, number] = [Math.round(base[0] * k), Math.round(base[1] * k)];
  spell(s, t, el, at, dmg, onBarrel);
  if (++fx.spells % ECHO_EVERY === 0 && has(s, 'echo') && fire(s, t, 'echo')) {
    s.events.push({ t, type: 'shoot', src: h.id, from: { ...h.pos }, to: { ...at }, text: 'echo' });
    spell(s, t, el, at, dmg, onBarrel);
  }
  return time;
}

function spell(s: GridState, t: number, el: NonNullable<Weapon['element']>, at: Cell, dmg: readonly [number, number], onBarrel: (c: Cell) => void): void {
  const h = s.hero;
  // the caster stands clear of their own spell
  applyElement(s, t, el, at, el === 'fire' || el === 'poison' ? 1 : 0, dmg, h.id, onBarrel, h.id);
  if (el === 'shock' && has(s, 'chain')) chainHops(s, t, at, dmg);
  for (const f of s.foes) if (f.alive && same(f.pos, at)) f.awake = true;
}

/** Lightning jumps on from where it struck to foes the splash did not reach. */
function chainHops(s: GridState, t: number, at: Cell, dmg: readonly [number, number]): void {
  const hit = new Set(s.foes.filter((f) => dist(f.pos, at) <= 1).map((f) => f.id));
  let cur = at;
  for (let i = 0; i < CHAIN_HOPS; i++) {
    const next = s.foes.filter((f) => f.alive && !hit.has(f.id) && dist(f.pos, cur) <= CHAIN_REACH && losClear(s.map, cur, f.pos)).sort(byDistTo(cur))[0];
    if (!next) return;
    fire(s, t, 'chain');
    hit.add(next.id);
    s.events.push({ t, type: 'shoot', src: s.hero.id, dst: next.id, from: { ...cur }, to: { ...next.pos }, text: 'chain' });
    hurt(s, t, s.hero.id, next, Math.max(1, Math.round(s.rng.int(dmg[0], dmg[1]) / 2)), 'shock');
    cur = next.pos;
  }
}
