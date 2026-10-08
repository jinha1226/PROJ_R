import { coverOf, hitChance, shotClear, strike } from './combat';
import { applyElement, areaCells, onEnter, tickStatuses } from './status';
import { championTurn } from './boss';
import { foeDmg } from './foes';
import { chestAt } from './actions';
import { findPath } from './path';
import { buffOn } from './buffs';
import { add, canStep, DIRS, dist, FOES, idx, same, tileAt, type Cell, type Ent, type GridState } from './types';


/** Cells a foe may not walk into: other bodies and chests. */
export const blockedFor = (s: GridState, self: Ent) => (c: Cell): boolean =>
  chestAt(s, c)?.opened === false || s.barrels.some((b) => same(b, c)) || s.foes.some((f) => f !== self && f.alive && same(f.pos, c)) || (s.hero.alive && same(s.hero.pos, c));

/** Steps one cell along a path toward `to`; false if there is no way. */
export function stepToward(s: GridState, f: Ent, to: Cell, t: number): boolean {
  const path = findPath(s.map, f.pos, to, blockedFor(s, f), 60);
  const next = path?.[0];
  if (!next || same(next, s.hero.pos) || blockedFor(s, f)(next)) return false;
  moveTo(s, f, next, t);
  return true;
}

/** Archers only shoot from where the hero can see them (so every shot comes with a visible aim line). */
export function archerCanShoot(s: GridState, f: Ent): boolean {
  return f.alive && f.awake && !buffOn(s.hero, 'invis', f.nextAt) && dist(f.pos, s.hero.pos) <= FOES.archer.range && s.visible.has(idx(s.map, f.pos)) && shotClear(s, f.pos, s.hero.pos);
}

/** Adjacent, and not across a wall corner. */
export function canMelee(s: GridState, f: Ent): boolean {
  // an invisible hero is not struck at
  if (buffOn(s.hero, 'invis', f.nextAt)) return false;
  const d = { x: s.hero.pos.x - f.pos.x, y: s.hero.pos.y - f.pos.y };
  return dist(f.pos, s.hero.pos) === 1 && (d.x === 0 || d.y === 0 || canStep(s.map, f.pos, d));
}

/** One foe turn; returns its time cost. */
export function foeTurn(s: GridState, f: Ent): number {
  const t = f.nextAt;
  const def = FOES[f.kind as keyof typeof FOES];
  // burning, poison and ice come first; a frozen or dead foe loses the turn
  if (tickStatuses(s, f, t) || !f.alive) return 1;
  if (!f.awake) return 1;
  // stunned (slammed by a mace): loses this turn
  if ((f.stun ?? 0) > 0) { f.stun!--; return 1; }
  // confused: a stumble somewhere; afraid: away from the hero
  if (buffOn(f, 'confuse', t)) { const c = steps(s, f); if (c.length) moveTo(s, f, s.rng.pick(c), t); return def.move; }
  if (buffOn(f, 'fear', t)) {
    const away = steps(s, f).sort((a, b) => dist(b, s.hero.pos) - dist(a, s.hero.pos))[0];
    if (away && dist(away, s.hero.pos) > dist(f.pos, s.hero.pos)) moveTo(s, f, away, t);
    return def.move;
  }
  if (f.kind === 'archer') return archerTurn(s, f, t);
  if (f.kind === 'mage') return mageTurn(s, f, t);
  if (f.kind === 'champion') return championTurn(s, f, t);
  if (canMelee(s, f)) {
    s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...s.hero.pos } });
    strike(s, t, f, s.hero, def.hit, foeDmg(f), 1, 'melee');
    return 1;
  }
  if (!stepToward(s, f, f.lastSeen ?? s.hero.pos, t)) return 1;
  return def.move;
}

/** Free neighbouring cells a foe could step to. */
function steps(s: GridState, f: Ent): Cell[] {
  return DIRS.filter((d) => canStep(s.map, f.pos, d)).map((d) => add(f.pos, d)).filter((c) => !blockedFor(s, f)(c));
}

function moveTo(s: GridState, f: Ent, to: Cell, t: number): void {
  if (tileAt(s.map, to) === 'door') {
    s.map.tiles[idx(s.map, to)] = 'open';
    s.events.push({ t, type: 'door', src: f.id, to: { ...to } });
  }
  s.events.push({ t, type: 'move', src: f.id, from: { ...f.pos }, to: { ...to } });
  f.pos = to;
  onEnter(s, f, t);
}

/** Archers keep 3–6 tiles away, shoot when the line is clear, and walk to a spot with a clear line when it is not. */
function archerTurn(s: GridState, f: Ent, t: number): number {
  const def = FOES.archer;
  const h = s.hero.pos;
  const d = dist(f.pos, h);
  if (seekCover(s, f, t)) return def.move;
  if (d <= 2) {
    const away = steps(s, f).sort((a, b) => dist(b, h) - dist(a, h))[0];
    if (away && dist(away, h) > d) { moveTo(s, f, away, t); return def.move; }
    if (canMelee(s, f)) {
      s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...h } });
      strike(s, t, f, s.hero, def.hit, [1, 2], 1, 'melee');
      return 1;
    }
  }
  if (archerCanShoot(s, f)) {
    s.events.push({ t, type: 'shoot', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...h } });
    strike(s, t, f, s.hero, hitChance(s.map, f.pos, h, def.hit), foeDmg(f), 1, 'shot');
    return 1;
  }
  return takeRange(s, f, t, def.move);
}

/** Cover preference is stable: preserve distance and DIRS ordering on equal cover. */
function shootingSteps(s: GridState, f: Ent): Cell[] {
  const h = s.hero.pos;
  const covered = (c: Cell) => Number(coverOf(s.map, h, c) !== 'none');
  return steps(s, f).filter(c => dist(c, h) >= 3 && dist(c, h) <= 6 && shotClear(s, c, h))
    .sort((a, b) => covered(b) - covered(a) || dist(a, h) - dist(b, h));
}
function seekCover(s: GridState, f: Ent, t: number): boolean {
  if (coverOf(s.map, s.hero.pos, f.pos) !== 'none') return false;
  const spot = shootingSteps(s, f)[0];
  if (!spot || coverOf(s.map, s.hero.pos, spot) === 'none') return false;
  moveTo(s, f, spot, t);
  return true;
}

/** Ranged foes: a neighbouring cell with a clear line in the 3–6 band, else close in. */
function takeRange(s: GridState, f: Ent, t: number, move: number): number {
  const h = s.hero.pos;
  const spot = shootingSteps(s, f)[0];
  if (spot) { moveTo(s, f, spot, t); return move; }
  return stepToward(s, f, f.lastSeen ?? h, t) ? move : 1;
}

/**
 * Mages mark the ground around the hero (fire or frost) and the spell lands two of their turns later —
 * long enough to walk out of it. They keep their distance like archers.
 */
function mageTurn(s: GridState, f: Ent, t: number): number {
  const pending = s.telegraphs.find((x) => x.src === f.id);
  if (pending) {
    if (t + 1e-9 < pending.at) return 1;
    s.telegraphs = s.telegraphs.filter((x) => x !== pending);
    s.events.push({ t, type: 'shoot', src: f.id, to: { ...pending.center }, text: 'spell' });
    applyElement(s, t, pending.el ?? 'fire', pending.center, 1, pending.dmg, f.id);
    return 1;
  }
  const h = s.hero.pos;
  const d = dist(f.pos, h);
  if (seekCover(s, f, t)) return FOES.mage.move;
  if (d <= 1) {
    const away = steps(s, f).sort((a, b) => dist(b, h) - dist(a, h))[0];
    if (away && dist(away, h) > d) { moveTo(s, f, away, t); return FOES.mage.move; }
  }
  if (d >= 2 && d <= FOES.mage.range && !buffOn(s.hero, 'invis', t) && s.visible.has(idx(s.map, f.pos)) && shotClear(s, f.pos, h)) {
    const el = s.rng.chance(0.5) ? 'fire' : 'frost';
    s.telegraphs.push({ cells: areaCells(s, h, 1), center: { ...h }, src: f.id, kind: 'spell', el, dmg: foeDmg(f), at: t + 2 });
    s.events.push({ t, type: 'telegraph', src: f.id, to: { ...h }, text: el });
    return 1;
  }
  return takeRange(s, f, t, FOES.mage.move);
}
