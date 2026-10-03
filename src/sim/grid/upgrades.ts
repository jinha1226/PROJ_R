import type { GridState } from './types';

export type UpgradeId = 'charge' | 'hp' | 'killCharge' | 'evasion' | 'gunDmg' | 'meleeDmg';
export const UPGRADES: Record<UpgradeId, { name: string; note: string }> = {
  charge: { name: '충전 확장', note: '충전 최대치 +2' },
  hp: { name: '보강 장갑', note: '최대 체력 +5' },
  killCharge: { name: '흡수 회로', note: '근접 처치 충전 +1' },
  evasion: { name: '회피 보조', note: '회피 +3%' },
  gunDmg: { name: '총열 강화', note: '총 피해 +1' },
  meleeDmg: { name: '근력 보조', note: '근접 피해 +1' },
};

/** Three distinct suit upgrades, drawn from the run's random stream. */
export function upgradeOffer(s: GridState): UpgradeId[] {
  return s.rng.shuffle(Object.keys(UPGRADES) as UpgradeId[]).slice(0, 3);
}

/** Apply a stacking suit upgrade for the rest of this run. */
export function applyUpgrade(s: GridState, id: UpgradeId): void {
  const h = s.hero;
  switch (id) {
    case 'charge': h.maxCharge += 2; h.charge = Math.min(h.maxCharge, h.charge + 2); break;
    case 'hp': h.maxHp += 5; h.hp += 5; break;
    case 'killCharge': h.bonus.killCharge++; break;
    case 'evasion': h.bonus.evasion += 0.03; break;
    case 'gunDmg': h.bonus.gunDmg++; break;
    case 'meleeDmg': h.bonus.meleeDmg++; break;
  }
}
