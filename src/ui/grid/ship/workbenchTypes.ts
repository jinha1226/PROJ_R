/**
 * The shape the workbench screen draws from. The sim's `workbenchModel(meta)` (docs/superpowers/plans/2026-10-05-base-overhaul.md,
 * Task 5) produces exactly this; until it lands the screen runs on `workbenchMock.ts`.
 */
export type Material = 'scrap' | 'soul' | 'relic' | 'remains';
export type ModSlot = 'barrel' | 'mag' | 'sight' | 'grip' | 'chest' | 'arms' | 'legs' | 'back' | 'heart';
export type ModStat = 'gunDmg' | 'hit' | 'maxCharge' | 'noise' | 'swap' | 'maxHp' | 'evasion' | 'shield' | 'meleeDmg' | 'move';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>; perk?: string; stone?: boolean; cost: Partial<Record<Material, number>> }
export interface WorkbenchSlot { slot: ModSlot; part: 'pistol' | 'suit'; label: string; fitted: ModDef | null }
export interface WorkbenchOption { mod: ModDef; owned: boolean; craftable: boolean; missing: Partial<Record<Material, number>>; fitted: boolean; locked?: boolean }
export interface WorkbenchModel {
  open: boolean;
  materials: Record<Material, number>;
  slots: WorkbenchSlot[];
  options(slot: ModSlot): WorkbenchOption[];
  stats(preview?: { slot: ModSlot; mod: string | null }): { label: string; now: number; next?: number }[];
}

export const MATERIAL_NAME: Record<Material, string> = { scrap: '고철', soul: '영혼 결정', relic: '고대 부품', remains: '정예 잔해' };
const STAT_NAME: Record<ModStat, string> = { gunDmg: '총 피해', hit: '명중', maxCharge: '충전', noise: '소음', swap: '교체', maxHp: '체력', evasion: '회피', shield: '보호막', meleeDmg: '칼 피해', move: '이동' };

/** "명중 +8% · 소음 +2" from a mod's stats. */
export function statLine(stats: ModDef['stats']): string {
  return Object.entries(stats).map(([k, v]) => {
    const pct = k === 'hit' || k === 'evasion';
    const n = pct ? Math.round(v * 100) : v;
    return `${STAT_NAME[k as ModStat]} ${n > 0 ? '+' : ''}${n}${pct ? '%' : ''}`;
  }).join(' · ');
}

/** What each behaviour mod does, in a few words. */
export const PERK_NOTE: Record<string, string> = {
  scatter: '명중 → 옆 적 2명 50% · 사거리 −3', pierceBarrel: '명중 → 뒤 적 70%', soulCell: '처치 → 충전 +1', elemChamber: '원소 효과 +1',
  runeScope: '잠든 적 사격 ×2', thermal: '벽 너머 적 감지', bayonetGrip: '권총 타격 = 칼 타격', doubleTap: '3연사째 충전 0',
  soulWeave: '층마다 보호막 6', reactive: '근접 피격 → 밀치기', hookArms: '2칸 적 끌어와 베기', shockArms: '근접 명중 20% 기절',
  chargeLegs: '이동 직후 근접 +3', silentLegs: '발소리 없음', regenPack: '전투 중 재생', elemTank: '화상·독 피해 +1',
  whirlHeart: '3행동마다 주변 베기', undyingHeart: '층마다 한 번 버팀',
};
/** A mod's effect: its stats, or what its behaviour does. */
export const modLine = (mod: ModDef): string => (mod.perk ? PERK_NOTE[mod.perk] ?? '' : statLine(mod.stats));
