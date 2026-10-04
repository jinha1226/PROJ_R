import { resonance } from './resonance';
import { absorbShield } from './shield';
import { emit } from './kataBus';
import { losClear } from './fov';
import { reactOn, reactOnTile, spreadShock, type ReactionKit } from './reactions';
import type { Element } from './items';
import { springTrap } from './traps';
import { dist, same, tileAt, walkable, type Cell, type Ent, type GridState, type Statuses } from './types';

export const STATUS_TURNS = { burn: 3, freeze: 2, poison: 6 };
const BURN_DMG = 2;
const POISON_DMG = 1;
const FIRE_TILE = 4;
const CLOUD_TILE = 3;
const CLOUD_POISON = 3;

const st = (e: Ent): Statuses => (e.status ??= { burn: 0, freeze: 0, poison: 0 });

export function entsAt(s: GridState, c: Cell): Ent[] {
  return [s.hero, ...s.foes].filter((e) => e.alive && same(e.pos, c));
}

/** Direct damage (elements, explosions, status ticks): no roll, emits hit and maybe die. */
export function hurt(s: GridState, t: number, src: string, dst: Ent, amount: number, text?: string): void {
  if (!dst.alive || amount <= 0) return;
  // anything that hurts a sleeper wakes it
  dst.awake = true;
  amount = absorbShield(s, t, dst, amount);
  dst.hp -= amount;
  s.events.push({ t, type: 'hit', src, dst: dst.id, amount, to: { ...dst.pos }, text });
  if (dst.hp <= 0) {
    dst.hp = 0;
    dst.alive = false;
    s.events.push({ t, type: 'die', src, dst: dst.id, to: { ...dst.pos } });
  }
  if (dst === s.hero && amount > 0) emit(s, 'hurt', { t, src, foe: s.foes.find(f => f.id === src) });
}

/** Adds a status. Poison stacks, the others refresh. */
export function addStatus(s: GridState, t: number, e: Ent, el: Element, src: string, engraving = false): void {
  const x = st(e);
  const bonus = src === s.hero.id ? Number(resonance(s).element) : 0;
  if (el === 'fire') x.burn = Math.max(x.burn, STATUS_TURNS.burn + bonus);
  if (el === 'frost') x.freeze = Math.min(engraving && e.kind === 'champion' ? 1 : Infinity, Math.max(x.freeze, STATUS_TURNS.freeze + bonus));
  if (el === 'poison') x.poison += STATUS_TURNS.poison + bonus;
  if (el !== 'shock') s.events.push({ t, type: 'status', src, dst: e.id, text: el, to: { ...e.pos } });
  if (src === s.hero.id) emit(s, 'elementApplied', { t, foe: e, src, element: el });
}

function setTile(s: GridState, c: Cell, kind: 'fire' | 'poison', turns: number): void {
  s.tiles = s.tiles.filter((x) => !same(x.pos, c));
  s.tiles.push({ pos: { ...c }, kind, until: s.time + turns });
}

/** Cells an area effect reaches: within the radius, walkable, in line from its centre. */
export function areaCells(s: GridState, at: Cell, radius: number): Cell[] {
  const out: Cell[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (walkable(tileAt(s.map, c)) && (radius === 0 || dist(c, at) === 0 || losClear(s.map, at, c))) out.push(c);
  }
  return out;
}

/**
 * An element landing on a cell (radius 0) or an area. Fire leaves burning ground and sets off barrels;
 * poison over an area leaves a cloud; lightning hits the target and half again to foes beside it.
 */
export function applyElement(s: GridState, t: number, el: Element, at: Cell, radius: number, dmg: readonly [number, number] | null, src: string, onBarrel?: (c: Cell) => void, spare?: string, engraving = false): void {
  const kit: ReactionKit = { hurt, ents: entsAt, area: areaCells };
  if (el === 'shock') {
    const target = entsAt(s, at)[0];
    if (!target) return;
    const amount = dmg ? s.rng.int(dmg[0], dmg[1]) : 4;
    const r = reactOn(s, t, 'shock', target, src, kit, engraving);
    hurt(s, t, src, target, r === 'shatter' ? amount * 2 : amount, 'shock');
    for (const f of s.foes) if (f !== target && f.alive && dist(f.pos, target.pos) === 1) hurt(s, t, src, f, Math.round(amount / 2), 'shock');
    if (r === 'shatter' || r === 'paralyse') spreadShock(s, t, at, src, r, amount, kit);
    if (src === s.hero.id) emit(s, 'elementApplied', { t, foe: target, src, element: el });
    return;
  }
  // one application reacts at most once (a 3×3 fireball over a poison cloud is one ignition)
  let reacted = false;
  for (const c of areaCells(s, at, radius)) {
    const occupants = entsAt(s, c);
    const here = occupants.filter((e) => e.id !== spare);
    for (const e of here) {
      if (dmg) hurt(s, t, src, e, s.rng.int(dmg[0], dmg[1]), el);
      if (!e.alive) continue;
      const r = reacted ? null : reactOn(s, t, el, e, src, kit, engraving);
      if (r) { reacted = true; continue; }
      if (e.alive) addStatus(s, t, e, el, src, engraving);
    }
    if (!reacted && !occupants.length && reactOnTile(s, t, el, c, src, kit)) { reacted = true; continue; }
    if (el === 'fire' && !occupants.length && !s.tiles.some((x) => x.kind === 'steam' && same(x.pos, c))) setTile(s, c, 'fire', FIRE_TILE);
    if (el === 'poison' && radius > 0) setTile(s, c, 'poison', CLOUD_TILE);
    if (el === 'fire' && s.barrels.some((b) => same(b, c))) onBarrel?.(c);
  }
}

/** Ground under an entity: burning ground sets it alight, a cloud poisons it. */
export function onEnter(s: GridState, e: Ent, t: number): void {
  springTrap(s, e, t);
  if (!e.alive) return;
  const tile = s.tiles.find((x) => same(x.pos, e.pos) && x.until > s.time);
  if (!tile) return;
  const x = st(e);
  if (tile.kind === 'fire' && x.burn === 0) addStatus(s, t, e, 'fire', 'tile');
  if (tile.kind === 'poison' && x.poison === 0) { x.poison += CLOUD_POISON; s.events.push({ t, type: 'status', src: 'tile', dst: e.id, text: 'poison', to: { ...e.pos } }); }
}

/** Start of an entity's turn: ground, burning, poison; returns true when frozen (the turn is lost). */
export function tickStatuses(s: GridState, e: Ent, t: number): boolean {
  onEnter(s, e, t);
  const x = e.status;
  if (!x) return false;
  if (x.burn > 0) { x.burn--; hurt(s, t, 'burn', e, BURN_DMG, 'fire'); }
  if (x.poison > 0 && e.alive) { x.poison--; hurt(s, t, 'poison', e, POISON_DMG, 'poison'); }
  if (x.freeze > 0 && e.alive) {
    x.freeze--;
    s.events.push({ t, type: 'frozen', src: e.id, to: { ...e.pos } });
    return true;
  }
  return false;
}
