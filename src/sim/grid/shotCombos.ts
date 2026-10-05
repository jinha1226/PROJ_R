import { takeRound, roundMult, roundHit } from './rounds';
import { activeWeapon } from './gear';
import { gunCost } from './kataTargets';
import { freeCell, shotClear, strike } from './combat';
import { fire, has } from './engraveCore';
import { buffOn } from './buffs';
import { onEnter } from './status';
import { canStep, dist, idx, same, type Cell, type Ent, type GridState } from './types';

const RAPID_TIME = 0.7;
const RAPID_CRIT = 2;
const RICOCHET_RANGE = 3;
const RICOCHET_CHANCE = 0.5;
const VOLLEY_EVERY = 3;
const VOLLEY_SHOTS = 2;
const VOLLEY_MULT = 0.7;
const MARK_PASS = 6;

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
  const powered = () => h.alive && h.charge >= gunCost(s, activeWeapon(h.gear)!);
  const extra = (f: Ent, from: Cell, text: string, mult = 1) => {
    const cost = gunCost(s, activeWeapon(h.gear)!);
    h.charge -= cost; h.fx.taps = (h.fx.taps ?? 0) + 1;
    const round = takeRound(s);
    s.events.push({ t, type: 'shoot', group: 'pistol', src: h.id, dst: f.id, from: { ...from }, to: { ...f.pos }, text });
    f.awake = true;
    if (strike(s, t, h, f, chanceAt(from, f.pos), dmg, mult * roundMult(s, t, round))) roundHit(s, t, f, round, true);
  };
  if (hit && has(s, 'mark')) { foe.marked = true; fire(s, t, 'mark'); }
  if (hit && !foe.alive && has(s, 'ricochet') && s.rng.chance(RICOCHET_CHANCE)) {
    const next = s.foes.filter((f) => f.alive && dist(f.pos, foe.pos) <= RICOCHET_RANGE && shotClear(s, foe.pos, f.pos)).sort(byDistTo(foe.pos))[0];
    if (next && powered() && fire(s, t, 'ricochet')) extra(next, foe.pos, 'ricochet');
  }
  if (has(s, 'volley') && ++fx.shots % VOLLEY_EVERY === 0) {
    const more = s.foes.filter((f) => f !== foe && f.alive && s.visible.has(idx(s.map, f.pos)) && dist(h.pos, f.pos) <= range && shotClear(s, h.pos, f.pos))
      .sort(byDistTo(h.pos)).slice(0, VOLLEY_SHOTS);
    if (more.length && powered() && fire(s, t, 'volley')) for (const f of more) {
      if (!powered()) break;
      if (f.alive) extra(f, h.pos, 'volley', VOLLEY_MULT);
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
