/**
 * The shape the workbench screen draws from. The sim's `workbenchModel(meta)` (docs/superpowers/plans/2026-10-05-base-overhaul.md,
 * Task 5) produces exactly this; until it lands the screen runs on `workbenchMock.ts`.
 */
export type Material = 'scrap' | 'soul' | 'relic' | 'remains';
export type ModSlot = 'barrel' | 'mag' | 'sight' | 'grip' | 'chest' | 'arms' | 'legs' | 'back' | 'heart';
export type ModStat = 'gunDmg' | 'hit' | 'maxCharge' | 'noise' | 'swap' | 'maxHp' | 'evasion' | 'shield' | 'meleeDmg' | 'move';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>; cost: Partial<Record<Material, number>> }
export interface WorkbenchSlot { slot: ModSlot; part: 'pistol' | 'suit'; label: string; fitted: ModDef | null }
export interface WorkbenchOption { mod: ModDef; owned: boolean; craftable: boolean; missing: Partial<Record<Material, number>>; fitted: boolean }
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
