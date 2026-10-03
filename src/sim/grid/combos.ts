import { foeAt, freeCell, shotClear, strike } from './combat';
import { blowMult, fire, has } from './engraveCore';
import { activeWeapon, swapHands } from './gear';
import { WEAPONS, type Weapon } from './items';
import { refillMelee } from './suitCharge';
import { onEnter } from './status';
import { add, canStep, COST, dist, idx, same, type Cell, type Ent, type GridState } from './types';
import { canFire, heroDmg, meleeAttack, pickUp, rangedAttack, weaponRange, type ShotHooks } from './weapons';

const DASH_TIME = 0.3;
const LEAP_TIME = 0.5;
const LEAP_MULT = 0.7;
const QUICK_MULT = 1.5;
const SWAP_STRIKE = 0.5;

/** May the hero swing at this neighbour (not through a wall corner)? */
const canSwingAt = (s: GridState, from: Cell, to: Cell): boolean => {
  const d = { x: to.x - from.x, y: to.y - from.y };
  return dist(from, to) === 1 && (d.x === 0 || d.y === 0 || canStep(s.map, from, d));
};

function stepTo(s: GridState, t: number, to: Cell, text: string): void {
  const h = s.hero;
  s.events.push({ t, type: 'move', src: h.id, from: { ...h.pos }, to: { ...to }, text });
  h.pos = to;
  pickUp(s, t);
  onEnter(s, h, t);
}

/**
 * Dash and leap: walking toward a foe two cells ahead lunges one cell in and strikes; a foe three cells ahead
 * is leapt at (two cells) and everything around the landing is hit. null when neither engraving applies.
 */
export function lunge(s: GridState, t: number, d: Cell, hooks: ShotHooks): number | null {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  // a spear already reaches two cells; a ranged weapon does not lunge
  if (!w || !WEAPONS[w.group].melee || w.group === 'spear') return null;
  const a = add(h.pos, d);
  const b = add(a, d);
  const seen = (f: Ent | undefined): f is Ent => !!f && s.visible.has(idx(s.map, f.pos));
  // a lunge never lands on the stairs (going down is a step the player takes on purpose)
  const open = (c: Cell) => freeCell(s, c) && !(s.map.stairs && same(c, s.map.stairs));
  if (!canStep(s.map, h.pos, d) || !open(a) || !canStep(s.map, a, d)) return null;
  const near = foeAt(s, b);
  if (seen(near) && has(s, 'dash')) {
    fire(s, t, 'dash');
    stepTo(s, t, a, 'dash');
    // a trap on the way (teleported off, or killed) ends the lunge there
    if (!h.alive || !same(h.pos, a)) return COST.move + DASH_TIME;
    return meleeAttack(s, t, d, near, hooks) + DASH_TIME;
  }
  const far = foeAt(s, add(b, d));
  if (!seen(far) || !has(s, 'leap') || !open(b) || !canStep(s.map, b, d)) return null;
  fire(s, t, 'leap');
  stepTo(s, t, b, 'leap');
  if (!h.alive || !same(h.pos, b)) return COST.move + LEAP_TIME;
  h.target = far.id;
  h.fx.acted = 'melee';
  const dmg = heroDmg(s, w);
  const eventStart = s.events.length;
  let landed = false;
  for (const f of s.foes) {
    if (!f.alive || !canSwingAt(s, b, f.pos)) continue;
    const mult = LEAP_MULT * blowMult(s, t, f) * (f.awake ? 1 : 2);
    f.awake = true;
    const hit = strike(s, t, h, f, WEAPONS[w.group].hit, dmg, mult);
    if (f === far) landed = hit;
  }
  refillMelee(s, landed, eventStart);
  h.fx.nextMult = 1;
  return WEAPONS[w.group].time + LEAP_TIME;
}

const handKind = (w: Weapon | null) => !w ? 'empty' : WEAPONS[w.group].melee ? 'melee' : w.group === 'staff' ? 'staff' : 'gun';

/** Suit swap effects depend on the weapon family before and after the swap. */
export function swapCombo(s: GridState, t: number, hooks: ShotHooks): number {
  const h = s.hero;
  const g = h.gear;
  const before = handKind(activeWeapon(g));
  swapHands(g);
  s.events.push({ t, type: 'swap', src: h.id, text: activeWeapon(g)?.name });
  let cost = COST.swap;
  if (has(s, 'quickswap') && before !== handKind(activeWeapon(g))) { fire(s, t, 'quickswap'); h.fx.nextMult = QUICK_MULT; cost = 0; }
  if (!has(s, 'swapstrike')) return cost;
  // a swap that strikes is never free (else quick swap + swap strike would land endless blows in no time)
  cost = COST.swap;
  const w = activeWeapon(g);
  if (!w) return cost;
  const want = (f: Ent) => (f.id === h.target ? 0 : 1);
  if (WEAPONS[w.group].melee) {
    const f = s.foes.filter((x) => x.alive && canSwingAt(s, h.pos, x.pos)).sort((x, y) => want(x) - want(y))[0];
    if (!f) return cost;
    fire(s, t, 'swapstrike');
    h.fx.nextMult *= SWAP_STRIKE;
    meleeAttack(s, t, { x: f.pos.x - h.pos.x, y: f.pos.y - h.pos.y }, f, hooks);
    return COST.swap;
  }
  const f = s.foes.filter((x) => x.alive && s.visible.has(idx(s.map, x.pos)) && dist(h.pos, x.pos) <= weaponRange(w) && shotClear(s, h.pos, x.pos))
    .sort((x, y) => want(x) - want(y) || dist(h.pos, x.pos) - dist(h.pos, y.pos))[0];
  if (!f || !canFire(s)) return cost;
  fire(s, t, 'swapstrike');
  h.fx.nextMult *= SWAP_STRIKE;
  rangedAttack(s, t, f, hooks);
  return COST.swap;
}

/** After a dodge (counter) or a parry (riposte): a blow straight back at the attacker beside the hero. */
export function counterBlow(s: GridState, t: number, src: string, how: 'dodge' | 'parry'): void {
  const h = s.hero;
  const id = how === 'dodge' ? 'counter' : 'riposte';
  const f = s.foes.find((x) => x.id === src && x.alive);
  const w = activeWeapon(h.gear);
  if (!f || !w || !WEAPONS[w.group].melee || !has(s, id) || !canSwingAt(s, h.pos, f.pos) || !fire(s, t, id)) return;
  s.events.push({ t, type: 'bump', src: h.id, dst: f.id, from: { ...h.pos }, to: { ...f.pos }, text: id });
  const eventStart = s.events.length;
  const landed = strike(s, t, h, f, WEAPONS[w.group].hit, heroDmg(s, w), blowMult(s, t, f));
  refillMelee(s, landed, eventStart);
}
