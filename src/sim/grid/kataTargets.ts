import { foeAt, freeCell, shotClear } from './combat';
import { canSwingAt } from './combos';
import { activeWeapon } from './gear';
import { otherHand } from './kata';
import { GUN_COST, isGun, type Weapon } from './items';
import { pistolCost } from './resonance';
import { weaponRange } from './weapons';
import { add, canStep, DIRS, dist, idx, same, type GridState } from './types';
import type { TriggerCtx } from './kataBus';

export const gunInHand = (s: GridState): Weapon | null => {
  const w = activeWeapon(s.hero.gear);
  return w && isGun(w.group) ? w : s.hero.gear.hands.find(w => w && isGun(w.group)) ?? null;
};
export const gunCost = (s: GridState, w: Weapon): number =>
  w.group === 'pistol' ? pistolCost(s, GUN_COST.pistol) : isGun(w.group) ? GUN_COST[w.group] : Infinity;
export const shotTarget = (s: GridState, c: TriggerCtx) => c.foe ?? s.foes.find(f => f.id === c.src);
export const inShot = (s: GridState, w: Weapon, c: TriggerCtx): boolean => {
  const f = shotTarget(s, c);
  return !!f?.alive && dist(s.hero.pos, f.pos) <= weaponRange(w) && shotClear(s, s.hero.pos, f.pos, c.through);
};
export function nearest(s: GridState) {
  const gun = otherHand(s);
  if (!gun || !isGun(gun.group)) return undefined;
  return s.foes.filter(f => s.visible.has(idx(s.map, f.pos)) && inShot(s, gun, { t: 0, foe: f }))
    .sort((a, b) => dist(s.hero.pos, a.pos) - dist(s.hero.pos, b.pos) || a.id.localeCompare(b.id))[0];
}
export function dashTarget(s: GridState) {
  const h = s.hero;
  const targets = DIRS.flatMap(d => {
    const mid = add(h.pos, d);
    const f = foeAt(s, add(mid, d));
    return f && s.visible.has(idx(s.map, f.pos)) && freeCell(s, mid) && canStep(s.map, h.pos, d) && canStep(s.map, mid, d)
      && !(s.map.stairs && same(mid, s.map.stairs)) ? [{ f, d, mid }] : [];
  });
  return targets.find(({ f }) => f.id === h.target) ?? targets[0];
}
export const spinTargets = (s: GridState, c: TriggerCtx) =>
  (c.neighbours ?? s.foes.filter(f => f.alive && canSwingAt(s, s.hero.pos, f.pos)))
    .filter(f => f !== c.foe && f.alive && canSwingAt(s, s.hero.pos, f.pos));
