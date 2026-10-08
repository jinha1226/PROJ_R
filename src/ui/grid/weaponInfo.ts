import { loadedRound, ROUND_NAMES } from '../../sim/grid/rounds';
import type { Hero } from '../../sim/grid/types';
import { isGun, WEAPONS, type Equipment, type Weapon, type WeaponGroup } from '../../sim/grid/items';

/** One line on what makes each weapon group different. */
export const GROUP_NOTE: Record<WeaponGroup, string> = {
  dagger: '빠름(0.7턴) · 잠든 적 기습 ×3',
  sword: '무난함 · 명중 높음',
  axe: '앞 3칸 휩쓸기 · 느림(1.4턴)',
  spear: '2칸 앞까지 찌름(관통)',
  mace: '밀치기 · 벽에 박으면 기절',
  bow: '1턴 · 화살 1',
  staff: '1턴 · 마나 2',
};

export function weaponState(w: Weapon, hero: Pick<Hero, 'charge' | 'maxCharge'>): string {
  if (isGun(w.group)) return `충전 ${hero.charge}/${hero.maxCharge}`;
  return '';
}

/** "6~9 피해 · 명중 90%" style stats for a weapon or armour. */
export function statLine(e: Equipment): string {
  if (e.kind === 'armor') return `피해 −${e.reduce}`;
  const d = WEAPONS[e.group];
  const [lo, hi] = d.dmg[e.tier - 1]!;
  return `${lo}~${hi} 피해 · 명중 ${Math.round(d.hit * 100)}%${d.range ? ` · 사거리 ${d.range}` : ''}`;
}

export function weaponLabel(w: Weapon, hero: Pick<Hero, 'rounds' | 'roundIdx'>): string {
  return w.name + (isGun(w.group) ? ` · ${ROUND_NAMES[loadedRound(hero) ?? 'plain']}` : '');
}
