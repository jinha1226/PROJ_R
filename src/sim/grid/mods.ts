import { afford, spend, type Material } from './materials';
import type { MetaState } from './meta';
import type { SystemId } from './repairs';
import type { Hero } from './types';
export type ModSlot = 'barrel' | 'mag' | 'sight' | 'grip' | 'chest' | 'arms' | 'legs' | 'back';
export type ModStat = 'gunDmg' | 'hit' | 'maxCharge' | 'noise' | 'swap' | 'maxHp' | 'evasion' | 'shield' | 'meleeDmg' | 'move';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>; cost: Partial<Record<Material, number>>; needs?: SystemId }
export const MODS: ModDef[] = [
  { id: 'longBarrel', slot: 'barrel', name: '장총열', stats: { hit: 0.08 }, cost: { scrap: 4 } },
  { id: 'heavyBarrel', slot: 'barrel', name: '중총열', stats: { gunDmg: 1, noise: 2 }, cost: { scrap: 3, relic: 2 } },
  { id: 'extMag', slot: 'mag', name: '확장 탄창', stats: { maxCharge: 2 }, cost: { scrap: 5 } },
  { id: 'soulCell', slot: 'mag', name: '영혼 전지', stats: { maxCharge: 4 }, cost: { soul: 4, remains: 1 } },
  { id: 'redDot', slot: 'sight', name: '점조준기', stats: { hit: 0.05 }, cost: { scrap: 3 } },
  { id: 'runeScope', slot: 'sight', name: '룬 조준경', stats: { hit: 0.12 }, cost: { relic: 4 } },
  { id: 'quickGrip', slot: 'grip', name: '속사 손잡이', stats: { swap: -0.25 }, cost: { scrap: 4 } },
  { id: 'plating', slot: 'chest', name: '강화 판', stats: { maxHp: 6 }, cost: { scrap: 6 } },
  { id: 'soulWeave', slot: 'chest', name: '영혼 직조', stats: { shield: 3 }, cost: { soul: 5 } },
  { id: 'servoArms', slot: 'arms', name: '서보 팔', stats: { meleeDmg: 1 }, cost: { scrap: 4, soul: 2 } },
  { id: 'sprintLegs', slot: 'legs', name: '질주 다리', stats: { evasion: 0.05 }, cost: { soul: 3 } },
  { id: 'silencer', slot: 'back', name: '소음 차폐', stats: { noise: -2 }, cost: { relic: 3, remains: 1 } },
];

export function canCraft(m: MetaState, id: string): boolean {
  const mod = MODS.find(mod => mod.id === id);
  return !!mod && m.repairs.includes('workbench') && (!mod.needs || m.repairs.includes(mod.needs))
    && !m.mods.owned.includes(id) && afford(m.materials, mod.cost);
}
export function craft(m: MetaState, id: string): boolean {
  if (!canCraft(m, id)) return false;
  const mod = MODS.find(mod => mod.id === id)!;
  spend(m.materials, mod.cost); m.mods.owned.push(id); return true;
}
export function fit(m: MetaState, slot: ModSlot, id: string | null): boolean {
  if (!MODS.some(mod => mod.slot === slot)) return false;
  if (id === null) { delete m.mods.fitted[slot]; return true; }
  if (!m.mods.owned.includes(id) || !MODS.some(mod => mod.id === id && mod.slot === slot)) return false;
  m.mods.fitted[slot] = id; return true;
}
export function modStats(fitted: MetaState['mods']['fitted']): Partial<Record<ModStat, number>> {
  const total: Partial<Record<ModStat, number>> = {};
  for (const [slot, id] of Object.entries(fitted)) {
    const mod = MODS.find(mod => mod.id === id && mod.slot === slot);
    for (const [key, value] of Object.entries(mod?.stats ?? {})) {
      const stat = key as ModStat; total[stat] = (total[stat] ?? 0) + value;
    }
  }
  return total;
}
/** Called only for a new run; saves already contain the applied stats. */
export function applyMods(h: Hero, m: MetaState): void {
  const stats = modStats(m.mods.fitted); h.modStats = stats;
  h.maxHp += stats.maxHp ?? 0; h.hp = h.maxHp;
  h.maxCharge += stats.maxCharge ?? 0; h.charge = h.maxCharge;
  h.shield = (h.shield ?? 0) + (stats.shield ?? 0);
  for (const stat of ['gunDmg', 'meleeDmg', 'evasion'] as const) h.bonus[stat] += stats[stat] ?? 0;
}
