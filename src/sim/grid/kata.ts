import { shootable } from './actions';
import { foeAt, freeCell, shotClear, strike } from './combat';
import { canSwingAt, stepTo } from './combos';
import { fire, has } from './engraveCore';
import { activeWeapon } from './gear';
import { GUN_COST, isGun, WEAPONS, type Weapon } from './items';
import { add, canStep, DIRS, dist, idx, same, type Ent, type GridState } from './types';
import { heroDmg, meleeAttack, rangedAttack, weaponRange, type ShotHooks } from './weapons';

export const REFLEX_HOOKS: ShotHooks = { noise: () => {}, cast: () => 1 };
export const otherHand = (s: GridState): Weapon | null => s.hero.gear.hands[s.hero.gear.active === 0 ? 1 : 0];

/** Restore the original hand even if a nested attack or hook throws. */
export function withOtherHand<T>(s: GridState, fn: () => T): T {
  const g = s.hero.gear;
  const was = g.active;
  g.active = was === 0 ? 1 : 0;
  try { return fn(); } finally { g.active = was; }
}
const killed = (s: GridState, start: number) => s.events.slice(start).some(e => e.type === 'die' && e.src === s.hero.id);
const gunInHand = (s: GridState) => {
  const w = activeWeapon(s.hero.gear);
  return w && isGun(w.group) ? w : s.hero.gear.hands.find(w => w && isGun(w.group)) ?? null;
};

export function gunRelay(s: GridState, t: number, start: number, hooks?: ShotHooks): void {
  const gun = otherHand(s);
  if (!hooks || !s.hero.alive || !has(s, 'gunRelay') || !killed(s, start) || !gun || !isGun(gun.group) || s.hero.charge < GUN_COST[gun.group]) return;
  withOtherHand(s, () => {
    const ids = shootable(s);
    const f = s.foes.filter(f => ids.includes(f.id)).sort((a, b) => dist(s.hero.pos, a.pos) - dist(s.hero.pos, b.pos) || a.id.localeCompare(b.id))[0];
    if (f && fire(s, t, 'gunRelay')) rangedAttack(s, t, f, hooks);
  });
}

/** The shot pays its usual time plus the dash, not a second full melee turn. */
export function bladeRelay(s: GridState, t: number, start: number, hooks: ShotHooks): number {
  const h = s.hero;
  const blade = otherHand(s);
  if (!h.alive || !has(s, 'bladeRelay') || !killed(s, start) || !blade || !WEAPONS[blade.group].melee || blade.group === 'spear') return 0;
  const targets = DIRS.flatMap(d => {
    const mid = add(h.pos, d);
    const f = foeAt(s, add(mid, d));
    return f && s.visible.has(idx(s.map, f.pos)) && freeCell(s, mid) && canStep(s.map, h.pos, d) && canStep(s.map, mid, d)
      && !(s.map.stairs && same(mid, s.map.stairs)) ? [{ f, d, mid }] : [];
  });
  const target = targets.find(({ f }) => f.id === h.target) ?? targets[0];
  if (!target || !fire(s, t, 'bladeRelay')) return 0;
  withOtherHand(s, () => {
    stepTo(s, t, target.mid, 'dash');
    if (h.alive && same(h.pos, target.mid)) meleeAttack(s, t, target.d, target.f, hooks);
  });
  return 0.3;
}

/** Snapshot swingable neighbours before the main blow, then fire at surviving others. */
export function spinShot(s: GridState, t: number, main: Ent, neighbours: Ent[]): void {
  const gun = gunInHand(s);
  const h = s.hero;
  const targets = neighbours.filter(f => f !== main && f.alive && canSwingAt(s, h.pos, f.pos));
  if (!h.alive || !has(s, 'spinShot') || neighbours.length < 2 || !targets.length || !gun || h.charge < 1 || !fire(s, t, 'spinShot')) return;
  for (const f of targets) {
    if (h.charge < 1) break;
    h.charge -= 1;
    s.events.push({ t, type: 'shoot', src: h.id, dst: f.id, from: { ...h.pos }, to: { ...f.pos }, text: 'spin', group: gun.group });
    f.awake = true;
    strike(s, t, h, f, 1, heroDmg(s, gun));
  }
}

export function counterShot(s: GridState, t: number, src: string): void {
  const f = s.foes.find(f => f.id === src && f.alive);
  const gun = gunInHand(s);
  if (!s.hero.alive || !has(s, 'counterShot') || !f || !gun || !isGun(gun.group) || s.hero.charge < GUN_COST[gun.group]
    || dist(s.hero.pos, f.pos) > weaponRange(gun) || !shotClear(s, s.hero.pos, f.pos) || !fire(s, t, 'counterShot')) return;
  const shot = () => rangedAttack(s, t, f, REFLEX_HOOKS);
  if (activeWeapon(s.hero.gear) === gun) shot();
  else withOtherHand(s, shot);
}

export function onStunned(s: GridState, t: number, foe: Ent): void {
  const h = s.hero;
  const gun = gunInHand(s);
  if (!h.alive || !has(s, 'execute') || !foe.alive || dist(h.pos, foe.pos) !== 1 || !gun || h.charge < 1 || !fire(s, t, 'execute')) return;
  h.charge -= 1;
  s.events.push({ t, type: 'shoot', src: h.id, dst: foe.id, from: { ...h.pos }, to: { ...foe.pos }, text: 'execute', group: gun.group });
  const amount = foe.kind === 'champion' ? Math.ceil(foe.maxHp * 0.25) : foe.hp;
  foe.hp = Math.max(0, foe.hp - amount);
  foe.awake = true;
  s.events.push({ t, type: 'hit', src: h.id, dst: foe.id, to: { ...foe.pos }, amount, crit: true });
  if (foe.hp === 0) {
    foe.alive = false;
    s.events.push({ t, type: 'die', src: h.id, dst: foe.id, to: { ...foe.pos } });
  }
}
