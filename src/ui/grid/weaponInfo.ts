import { WEAPONS, type Equipment, type Weapon, type WeaponGroup } from '../../sim/grid/items';

/** One line on what makes each weapon group different. */
export const GROUP_NOTE: Record<WeaponGroup, string> = {
  dagger: '빠름(0.7턴) · 잠든 적 기습 ×3',
  sword: '무난함 · 명중 높음',
  axe: '앞 3칸 휩쓸기 · 느림(1.4턴)',
  spear: '2칸 앞까지 찌름(관통)',
  mace: '밀치기 · 벽에 박으면 기절',
  bow: '장전 0.5턴 · 피해 낮음',
  crossbow: '한 방이 셈 · 장전 1.5턴',
  throwing: '장전 없음 · 던진 건 다시 주움',
  staff: '충전식 마법 · 8턴마다 1회 회복',
};

export function weaponState(w: Weapon, arrows: number): string {
  if (w.group === 'bow' || w.group === 'crossbow') return w.loaded ? (arrows > 0 ? '장전됨' : '화살 없음') : '빔';
  if (w.group === 'throwing') return `${w.stack ?? 0}개`;
  if (w.group === 'staff') return `충전 ${w.charges ?? 0}`;
  return '';
}

/** "6~9 피해 · 명중 90%" style stats for a weapon or armour. */
export function statLine(e: Equipment): string {
  if (e.kind === 'armor') return `피해 −${e.reduce}`;
  const d = WEAPONS[e.group];
  const [lo, hi] = d.dmg[e.tier - 1]!;
  return `${lo}~${hi} 피해 · 명중 ${Math.round(d.hit * 100)}%${d.range ? ` · 사거리 ${d.range}` : ''}`;
}
