import { tapCost } from './perks';
import { isRanged, type Weapon } from './items';
import { same, type Cell, type GridState } from './types';

/** Bow shots always spend an arrow; staff mana retains engraving/perk discounts. */
export const rangedCost = (s: GridState, w: Weapon, override?: number): number =>
  w.group === 'bow' ? 0 : w.group === 'staff' ? tapCost(s.hero, override ?? 2) : Infinity;
export const rangedReady = (s: GridState, w: Weapon | null, override?: number): boolean =>
  s.hero.alive && !!w && isRanged(w.group) && (w.group === 'bow' ? s.hero.arrows > 0 : s.hero.charge >= rangedCost(s, w, override));
export function spendShot(s: GridState, w: Weapon, cost: number): void {
  if (w.group === 'bow') s.hero.arrows--;
  else s.hero.charge -= cost;
}
export function recoverArrow(s: GridState, w: Weapon, at: Cell, hit: boolean): void {
  if (w.group !== 'bow' || !s.rng.chance(hit ? 0.5 : 0.3)) return;
  const existing = s.floorItems.find(f => same(f.pos, at) && f.item.kind === 'arrows');
  if (existing?.item.kind === 'arrows') existing.item.n++;
  else s.floorItems.push({ pos: { ...at }, item: { kind: 'arrows', n: 1 } });
}
