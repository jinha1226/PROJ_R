import { bodyAt, hitChance, shotClear, strike } from './combat';
import { activeWeapon, addToBag, CLASS_BONUS } from './gear';
import { makeWeapon, STAFF_CHARGES, STAFF_RECHARGE, WEAPONS, type Weapon } from './items';
import { add, canStep, COST, dist, HERO, same, tileAt, walkable, type Cell, type Ent, type GridState } from './types';

const SNEAK = 2;
const DAGGER_SNEAK = 3;
const SLAM = 3;

/** Damage range of the hero's weapon: tier, +1 per level above 1, warriors hit harder in melee. */
export function heroDmg(s: GridState, w: Weapon): [number, number] {
  const [lo, hi] = WEAPONS[w.group].dmg[w.tier - 1]!;
  const up = s.hero.level - 1;
  const k = WEAPONS[w.group].melee ? CLASS_BONUS[s.hero.gear.cls].meleeDmg : 1;
  return [Math.round((lo + up) * k), Math.round((hi + up) * k)];
}

const foeAt = (s: GridState, c: Cell): Ent | undefined => s.foes.find((f) => f.alive && same(f.pos, c));
const free = (s: GridState, c: Cell) => walkable(tileAt(s.map, c)) && !bodyAt(s, c) && !s.chests.some((ch) => !ch.opened && same(ch.pos, c));

/** Cells beside the bump direction an axe also sweeps (front-left and front-right). */
function sweepCells(from: Cell, d: Cell): Cell[] {
  const sides = d.x !== 0 && d.y !== 0 ? [{ x: d.x, y: 0 }, { x: 0, y: d.y }] : d.x !== 0 ? [{ x: d.x, y: -1 }, { x: d.x, y: 1 }] : [{ x: -1, y: d.y }, { x: 1, y: d.y }];
  return sides.map((sd) => add(from, sd));
}

/** One melee blow with the weapon in hand (or a bash with a ranged one); returns its time cost. */
export function meleeAttack(s: GridState, t: number, d: Cell, foe: Ent): number {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  s.events.push({ t, type: 'bump', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos } });
  h.target = foe.id;
  if (!w || !WEAPONS[w.group].melee) {
    foe.awake = true;
    strike(s, t, h, foe, HERO.bashHit, HERO.bash);
    return COST.bash;
  }
  const def = WEAPONS[w.group];
  const dmg = heroDmg(s, w);
  const blow = (f: Ent) => {
    const mult = f.awake ? 1 : w.group === 'dagger' ? DAGGER_SNEAK : SNEAK;
    f.awake = true;
    return strike(s, t, h, f, def.hit, dmg, mult);
  };
  const landed = blow(foe);
  if (w.group === 'axe') for (const c of sweepCells(h.pos, d)) {
    const f = foeAt(s, c);
    const step = { x: c.x - h.pos.x, y: c.y - h.pos.y };
    // a diagonal swing does not pass through a wall corner
    if (f && (step.x === 0 || step.y === 0 || canStep(s.map, h.pos, step))) blow(f);
  }
  if (w.group === 'spear') {
    const beyond = add(foe.pos, d);
    const f = foeAt(s, beyond);
    if (f && canStep(s.map, foe.pos, d)) blow(f);
  }
  if (w.group === 'mace' && landed && foe.alive) {
    const to = add(foe.pos, d);
    if (free(s, to) && canStep(s.map, foe.pos, d)) {
      s.events.push({ t, type: 'push', src: foe.id, from: { ...foe.pos }, to: { ...to } });
      foe.pos = to;
    } else {
      foe.hp -= SLAM;
      foe.stun = Math.max(foe.stun ?? 0, 1);
      s.events.push({ t, type: 'stun', src: h.id, dst: foe.id, amount: SLAM, to: { ...foe.pos } });
      if (foe.hp <= 0) { foe.hp = 0; foe.alive = false; s.events.push({ t, type: 'die', src: h.id, dst: foe.id, to: { ...foe.pos } }); }
    }
  }
  return def.time;
}

/** A spear reaches a foe two cells away when the cell between is empty. */
export function reachTarget(s: GridState, d: Cell): Ent | undefined {
  const h = s.hero;
  if (activeWeapon(h.gear)?.group !== 'spear') return undefined;
  const mid = add(h.pos, d);
  if (!canStep(s.map, h.pos, d) || bodyAt(s, mid) || !canStep(s.map, mid, d)) return undefined;
  return foeAt(s, add(mid, d));
}

export function weaponRange(w: Weapon | null): number {
  return w && !WEAPONS[w.group].melee ? WEAPONS[w.group].range ?? 6 : 8;
}

/** Can the weapon in hand fire right now (loaded, arrows, stack, charges)? */
export function canFire(s: GridState): boolean {
  const w = activeWeapon(s.hero.gear);
  if (!w || WEAPONS[w.group].melee) return false;
  if (w.group === 'bow' || w.group === 'crossbow') return !!w.loaded && s.hero.gear.arrows > 0;
  if (w.group === 'throwing') return (w.stack ?? 0) > 0;
  return (w.charges ?? 0) > 0;
}

/** Fires the ranged weapon in hand at a foe; null if it cannot. Staff spells are resolved by `cast`. */
export function rangedAttack(s: GridState, t: number, foe: Ent, cast: (w: Weapon, at: Cell) => void, noise: (at: Cell, r: number) => void): number | null {
  const h = s.hero;
  const w = activeWeapon(h.gear);
  if (!w || !canFire(s) || dist(h.pos, foe.pos) > weaponRange(w) || !shotClear(s, h.pos, foe.pos)) return null;
  h.target = foe.id;
  s.events.push({ t, type: 'shoot', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos }, text: w.group });
  if (w.group === 'staff') {
    w.charges = (w.charges ?? 1) - 1;
    cast(w, foe.pos);
    noise(h.pos, 6);
    return WEAPONS.staff.time;
  }
  const chance = hitChance(s.map, h.pos, foe.pos, WEAPONS[w.group].hit + CLASS_BONUS[h.gear.cls].rangedHit);
  const mult = foe.awake ? 1 : SNEAK;
  foe.awake = true;
  const hit = strike(s, t, h, foe, chance, heroDmg(s, w), mult);
  if (w.group === 'throwing') {
    w.stack = (w.stack ?? 1) - 1;
    const land = hit ? foe.pos : add(foe.pos, { x: Math.sign(foe.pos.x - h.pos.x), y: Math.sign(foe.pos.y - h.pos.y) });
    const spot = walkable(tileAt(s.map, land)) ? land : foe.pos;
    s.floorItems.push({ pos: { ...spot }, item: { ...makeWeapon('throwing', w.tier), stack: 1 } });
  } else {
    w.loaded = false;
    h.gear.arrows--;
    noise(h.pos, w.group === 'crossbow' ? 6 : 3);
  }
  return WEAPONS[w.group].time;
}

export function reload(s: GridState): number | null {
  const w = activeWeapon(s.hero.gear);
  if (!w || (w.group !== 'bow' && w.group !== 'crossbow') || w.loaded || s.hero.gear.arrows <= 0) return null;
  w.loaded = true;
  return (WEAPONS[w.group].reload ?? 1) * CLASS_BONUS[s.hero.gear.cls].reload;
}

/** Staffs regain a charge every 8 turns (twice as fast for a mage). */
export function rechargeStaffs(s: GridState, spent: number): void {
  const g = s.hero.gear;
  const b = CLASS_BONUS[g.cls];
  g.staffClock = (g.staffClock ?? 0) + spent * b.recharge;
  while (g.staffClock >= STAFF_RECHARGE - 1e-9) {
    g.staffClock -= STAFF_RECHARGE;
    for (const w of [...g.hands, ...g.bag]) if (w?.kind === 'weapon' && w.group === 'staff') w.charges = Math.min(STAFF_CHARGES + b.charges, (w.charges ?? 0) + 1);
  }
}

/** Walking onto a cell picks up what lies there: thrown daggers rejoin a stack in hand, the rest goes to the bag. */
export function pickUp(s: GridState, t: number): void {
  const g = s.hero.gear;
  s.floorItems = s.floorItems.filter((f) => {
    if (!same(f.pos, s.hero.pos)) return true;
    const it = f.item;
    const stack = it.kind === 'weapon' && it.group === 'throwing' ? g.hands.find((w) => w?.group === 'throwing') : undefined;
    if (stack && it.kind === 'weapon') { stack.stack = (stack.stack ?? 0) + (it.stack ?? 1); s.events.push({ t, type: 'pickup', src: s.hero.id, text: it.name }); return false; }
    if (addToBag(g, it)) { s.events.push({ t, type: 'pickup', src: s.hero.id, text: it.name }); return false; }
    s.events.push({ t, type: 'full', src: s.hero.id, text: it.name });
    return true;
  });
}
