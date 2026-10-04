import { preMelee } from './preMelee';
import { bladeRound, takeRound, roundMult, roundHit } from './rounds';
import { withOtherHand, otherHand } from './kata';
import { emitKills } from './attackTriggers';
import { emit } from './kataBus';
import { resonance } from './resonance';
import { gunCost } from './kataTargets';
import { canSwingAt } from './combos';
import { gainMaterial } from './materials';
import { foeAt, freeCell, hitChance, shotClear, strike } from './combat';
import { blowMult, fire, has } from './engraveCore';
import { afterShot, rapidStep } from './shotCombos';
import { refillMelee } from './suitCharge';
import { buffOn } from './buffs';
import { stow } from './consumables';
import { potionName, scrollName } from './lore';
import { activeWeapon, addToBag } from './gear';
import { isGun, WEAPONS, type Weapon } from './items';
import { hurt, onEnter } from './status';
import { add, canStep, COST, dist, HERO, same, tileAt, type Cell, type Ent, type GridState } from './types';

const SNEAK = 2;
const DAGGER_SNEAK = 3;
const SLAM = 3;
const SLAM_WAVE = 3;
const FINISH_AT = 3;
const FINISH_MULT = 1.5;

/** Damage range of the hero's weapon: tier, +1 per level above 1 melee strength and suit upgrades. */
export function heroDmg(s: GridState, w: Weapon): [number, number] {
  const [lo, hi] = WEAPONS[w.group].dmg[w.tier - 1]!;
  const up = s.hero.level - 1;
  const melee = WEAPONS[w.group].melee;
  // strength above 10 adds to every melee blow
  const str = melee ? Math.max(0, s.hero.str - 10) : 0;
  const bonus = melee ? s.hero.bonus.meleeDmg + Number(resonance(s).melee) : isGun(w.group) ? s.hero.bonus.gunDmg : 0;
  return [lo + up + str + bonus, hi + up + str + bonus];
}

export interface ShotHooks { noise(at: Cell, r: number): void }

/** Cells beside the bump direction an axe also sweeps (front-left and front-right). */
function sweepCells(from: Cell, d: Cell): Cell[] {
  const sides = d.x !== 0 && d.y !== 0 ? [{ x: d.x, y: 0 }, { x: 0, y: d.y }] : d.x !== 0 ? [{ x: d.x, y: -1 }, { x: d.x, y: 1 }] : [{ x: -1, y: d.y }, { x: 1, y: d.y }];
  return sides.map((sd) => add(from, sd));
}

/** Shoves a foe one cell; against a wall or another body it is slammed instead (damage + stun, a wall-slam shockwave). */
export function pushFoe(s: GridState, t: number, foe: Ent, d: Cell): void {
  const to = add(foe.pos, d);
  if (freeCell(s, to) && canStep(s.map, foe.pos, d)) {
    s.events.push({ t, type: 'push', src: foe.id, from: { ...foe.pos }, to: { ...to } });
    foe.pos = to;
    onEnter(s, foe, t);
    return;
  }
  foe.hp -= SLAM;
  foe.stun = Math.max(foe.stun ?? 0, 1);
  s.events.push({ t, type: 'stun', src: s.hero.id, dst: foe.id, amount: SLAM, to: { ...foe.pos } });
  if (foe.hp <= 0) { foe.hp = 0; foe.alive = false; s.events.push({ t, type: 'die', src: s.hero.id, dst: foe.id, to: { ...foe.pos } }); }
  emit(s, 'stunned', { t, foe, src: 'slam' });
  if (has(s, 'wallslam') && fire(s, t, 'wallslam')) {
    for (const f of s.foes) if (f !== foe && f.alive && dist(f.pos, foe.pos) === 1) hurt(s, t, s.hero.id, f, SLAM_WAVE, 'slam');
  }
}

/** Same foe hit again and again: the count, and whether this blow is the finisher. */
function comboStep(s: GridState, foe: Ent): { next: number; finisher: boolean } {
  const c = s.hero.fx.combo;
  const next = c.target === foe.id ? c.hits + 1 : 1;
  return { next, finisher: next >= FINISH_AT && has(s, 'finisher') };
}

/** One melee blow with the weapon in hand (or a bash with a ranged one); returns its time cost. */
export function meleeAttack(s: GridState, t: number, d: Cell, foe: Ent, hooks?: ShotHooks): number {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  const armed = !!w && WEAPONS[w.group].melee;
  const neighbours = s.foes.filter(f => f.alive && canSwingAt(s, h.pos, f.pos));
  const afterBlow: (() => void)[] = [];
  if (neighbours.length >= 2) emit(s, 'surrounded', { t, foe, neighbours, hooks, afterBlow });
  const combo = comboStep(s, foe);
  s.events.push({ t, type: 'bump', group: w?.group, src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos }, text: armed && combo.finisher ? 'finisher' : undefined });
  h.target = foe.id;
  h.fx.acted = 'melee';
  const eventStart = s.events.length;
  if (!w || !armed) {
    foe.awake = true;
    const landed = preMelee(s, t, foe, () => strike(s, t, h, foe, HERO.bashHit, HERO.bash, h.fx.nextMult), 1);
    refillMelee(s, landed, eventStart);
    if (landed) emit(s, 'meleeHit', { t, foe, hooks, src: w && isGun(w.group) ? 'bash' : 'unarmed' });
    afterBlow.forEach(resolve => resolve());
    emitKills(s, t, eventStart, 'meleeKill', hooks);
    return COST.bash;
  }
  const def = WEAPONS[w.group];
  const dmg = heroDmg(s, w);
  // an invisible hero's blows land like sneak attacks
  const unseen = buffOn(h, 'invis', t);
  const hits: Ent[] = [];
  const blow = (f: Ent, k = 1) => preMelee(s, t, f, () => {
    const mult = (f.awake && !unseen ? 1 : w.group === 'dagger' ? DAGGER_SNEAK : SNEAK) * k * blowMult(s, t, f);
    f.awake = true;
    const hit = strike(s, t, h, f, def.hit, dmg, mult);
    if (hit) hits.push(f);
    return hit;
  });
  const landed = blow(foe, combo.finisher ? FINISH_MULT : 1);
  if (w.group === 'axe') for (const c of sweepCells(h.pos, d)) {
    const f = foeAt(s, c);
    const step = { x: c.x - h.pos.x, y: c.y - h.pos.y };
    // a diagonal swing does not pass through a wall corner
    if (f && (step.x === 0 || step.y === 0 || canStep(s.map, h.pos, step))) blow(f);
  }
  if (w.group === 'spear') {
    const beyond = add(foe.pos, d);
    const f = foeAt(s, beyond);
    if (f && canStep(s.map, foe.pos, d) && tileAt(s.map, beyond) !== 'door') blow(f);
  }
  h.fx.nextMult = 1;
  h.fx.combo = { target: foe.id, hits: landed && !combo.finisher ? combo.next : 0 };
  if (landed && combo.next >= 2) s.events.push({ t, type: 'combo', src: h.id, dst: foe.id, amount: combo.next, text: combo.finisher ? 'finisher' : undefined });
  let pushed = false;
  const shove = () => { if (!pushed && foe.alive) { pushed = true; pushFoe(s, t, foe, d); } };
  if (w.group === 'mace' && landed) shove();
  if (combo.finisher && landed && fire(s, t, 'finisher')) shove();
  refillMelee(s, landed, eventStart);
  for (const f of hits) { bladeRound(s, t, f); emit(s, 'meleeHit', { t, foe: f, hooks, src: 'blade' }); }
  afterBlow.forEach(resolve => resolve());
  if (landed && foe.alive && hooks && has(s, 'shoveShot')) shoveShot(s, t, foe, hooks, shove);
  emitKills(s, t, eventStart, 'meleeKill', hooks);
  return def.time;
}

/** Shove the foe off, then the ranged weapon in the other hand fires at it (the hand in use stays). */
function shoveShot(s: GridState, t: number, foe: Ent, hooks: ShotHooks, shove: () => void): void {
  const other = otherHand(s);
  if (!other || !isGun(other.group) || s.fired.has('shoveShot') || !withOtherHand(s, () => canFire(s))) return;
  shove();
  if (!foe.alive || !s.hero.alive || !withOtherHand(s, () => canFire(s)) || !fire(s, t, 'shoveShot')) return;
  withOtherHand(s, () => rangedAttack(s, t, foe, hooks));
  s.hero.fx.acted = 'melee';
}

/** A spear reaches a foe two cells away when the cell between is empty. */
export function reachTarget(s: GridState, d: Cell): Ent | undefined {
  const h = s.hero;
  if (activeWeapon(h.gear)?.group !== 'spear') return undefined;
  const mid = add(h.pos, d);
  // a closed door between stops the reach
  if (!canStep(s.map, h.pos, d) || tileAt(s.map, mid) === 'door' || foeAt(s, mid) || !canStep(s.map, mid, d)) return undefined;
  return foeAt(s, add(mid, d));
}

export function weaponRange(w: Weapon | null): number {
  return w && !WEAPONS[w.group].melee ? WEAPONS[w.group].range ?? 6 : 8;
}

/** Can the weapon in hand fire with its current charge? */
export function canFire(s: GridState): boolean {
  const w = activeWeapon(s.hero.gear);
  if (!w || WEAPONS[w.group].melee) return false;
  if (isGun(w.group)) return s.hero.charge >= gunCost(s, w);
  return false;
}

/** Fires the ranged weapon in hand at a foe; null if it cannot. */
export function rangedAttack(s: GridState, t: number, foe: Ent, hooks: ShotHooks, shot: { chargeCost?: number; through?: Ent } = {}): number | null {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  const cost = shot.chargeCost ?? (w ? gunCost(s, w) : Infinity);
  if (!h.alive || !foe.alive || !w || !isGun(w.group) || h.charge < cost || dist(h.pos, foe.pos) > weaponRange(w) || !shotClear(s, h.pos, foe.pos, shot.through)) return null;
  emit(s, 'preShot', { t, foe, hooks, shotCost: cost });
  h.target = foe.id;
  h.fx.acted = 'shot';
  s.events.push({ t, type: 'shoot', group: w.group, src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos }, text: w.group });
  if (!isGun(w.group)) return null;
  const eventStart = s.events.length;
  const base = WEAPONS[w.group].hit + (h.modStats?.hit ?? 0);
  const chanceAt = (from: Cell, to: Cell) => hitChance(s.map, from, to, base);
  const round = takeRound(s);
  const elementMult = roundMult(s, t, round);
  const rapid = rapidStep(s, t, foe);
  const dmg = heroDmg(s, w);
  const mult = (foe.awake && !buffOn(h, 'invis', t) ? 1 : SNEAK) * rapid.mult * blowMult(s, t, foe) * elementMult;
  foe.awake = true;
  const hit = strike(s, t, h, foe, chanceAt(h.pos, foe.pos), dmg, mult);
  h.charge -= cost;
  hooks.noise(h.pos, Math.max(0, 4 + (h.modStats?.noise ?? 0)));
  h.fx.nextMult = 1;
  if (hit) roundHit(s, t, foe, round);
  afterShot(s, t, foe, hit, dmg, chanceAt, weaponRange(w));
  if (hit) emit(s, 'gunHit', { t, foe, hooks, shotCost: cost });
  return WEAPONS[w.group].time * rapid.time + emitKills(s, t, eventStart, 'gunKill', hooks, cost);
}

/** A ranged shot at a barrel (it goes off); null if the weapon in hand cannot reach it. */
export function shootCell(s: GridState, t: number, at: Cell, explode: (c: Cell) => void, noise?: (at: Cell, r: number) => void): number | null {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  if (!w || !canFire(s) || !s.barrels.some((b) => same(b, at)) || dist(h.pos, at) > weaponRange(w)) return null;
  const others = s.barrels.filter((b) => !same(b, at));
  const saved = s.barrels;
  s.barrels = others;
  const clear = shotClear(s, h.pos, at);
  s.barrels = saved;
  if (!clear) return null;
  s.events.push({ t, type: 'shoot', group: w.group, src: h.id, from: { ...h.pos }, to: { ...at }, text: w.group });
  h.fx.acted = 'shot';
  if (isGun(w.group)) h.charge -= gunCost(s, w);
  noise?.(h.pos, Math.max(0, 4 + (h.modStats?.noise ?? 0)));
  takeRound(s);
  explode(at);
  return WEAPONS[w.group].time;
}

/** Walking onto a cell picks up its items into the appropriate inventory. */
export function pickUp(s: GridState, t: number): void {
  const g = s.hero.gear;
  s.floorItems = s.floorItems.filter((f) => {
    if (!same(f.pos, s.hero.pos)) return true;
    const it = f.item;
    if (it.kind === 'suit') {
      s.run.recovered = [...it.ids];
      s.events.push({ t, type: 'suit', text: it.ids.join(',') });
      return false;
    }
    if (it.kind === 'material') { gainMaterial(s, t, it.mat, it.n); return false; }
    if (it.kind === 'core') {
      s.outcome = 'won';
      s.run.won = true;
      s.events.push({ t, type: 'core', src: s.hero.id }, { t, type: 'victory', src: s.hero.id });
      return false;
    }
    if (it.kind === 'potion' || it.kind === 'scroll') {
      stow(s, it);
      s.events.push({ t, type: 'pickup', src: s.hero.id, text: it.kind === 'potion' ? potionName(s, it.p) : scrollName(s, it.sc) });
      return false;
    }
    if (addToBag(g, it)) { s.events.push({ t, type: 'pickup', src: s.hero.id, text: it.name }); return false; }
    s.events.push({ t, type: 'full', src: s.hero.id, text: it.name });
    return true;
  });
}
