import { stoneMod } from './stones';
import { floorPerks } from './perks';
import { afford, spend, type Material } from './materials';
import type { MetaState } from './meta';
import type { Hero } from './types';
export type ModSlot = 'barrel' | 'mag' | 'sight' | 'grip' | 'chest' | 'arms' | 'legs' | 'back' | 'heart';
export type ModStat = 'gunDmg' | 'hit' | 'maxCharge' | 'noise' | 'swap' | 'maxHp' | 'evasion' | 'shield' | 'meleeDmg' | 'move';
export type PerkId = 'scatter' | 'pierceBarrel' | 'soulCell' | 'elemChamber' | 'runeScope' | 'thermal'
  | 'bayonetGrip' | 'doubleTap' | 'soulWeave' | 'reactive' | 'hookArms' | 'shockArms'
  | 'chargeLegs' | 'silentLegs' | 'regenPack' | 'elemTank' | 'whirlHeart' | 'undyingHeart';
export interface ModDef { id: string; slot: ModSlot; name: string; stats: Partial<Record<ModStat, number>>;
  perk?: PerkId; stone: boolean; cost: Partial<Record<Material, number>> }
export const MODS: ModDef[] = [
  { id: 'whirlHeart', slot: 'heart', name: '선회의 핵', stats: {}, perk: 'whirlHeart', stone: true, cost: {} },
  { id: 'undyingHeart', slot: 'heart', name: '불굴의 핵', stats: {}, perk: 'undyingHeart', stone: true, cost: {} },
  { id: 'longBarrel', slot: 'barrel', name: '장총열', stats: { hit: 0.08 }, stone: false, cost: { scrap: 4 } },
  { id: 'scatter', slot: 'barrel', name: '산탄 총열', stats: {}, perk: 'scatter', stone: true, cost: { scrap: 4, soul: 2 } },
  { id: 'pierceBarrel', slot: 'barrel', name: '관통 총열', stats: {}, perk: 'pierceBarrel', stone: true, cost: { scrap: 3, relic: 2 } },
  { id: 'extMag', slot: 'mag', name: '확장 탄창', stats: { maxCharge: 2 }, stone: false, cost: { scrap: 5 } },
  { id: 'soulCell', slot: 'mag', name: '영혼 전지', stats: {}, perk: 'soulCell', stone: true, cost: { soul: 4, remains: 1 } },
  { id: 'elemChamber', slot: 'mag', name: '원소 약실', stats: {}, perk: 'elemChamber', stone: true, cost: { relic: 3, soul: 2 } },
  { id: 'redDot', slot: 'sight', name: '점조준기', stats: { hit: 0.1 }, stone: false, cost: { scrap: 3 } },
  { id: 'runeScope', slot: 'sight', name: '룬 조준경', stats: {}, perk: 'runeScope', stone: true, cost: { relic: 4 } },
  { id: 'thermal', slot: 'sight', name: '열 감지경', stats: {}, perk: 'thermal', stone: true, cost: { soul: 3, relic: 2 } },
  { id: 'quickGrip', slot: 'grip', name: '속사 손잡이', stats: { swap: -0.25 }, stone: false, cost: { scrap: 4 } },
  { id: 'bayonetGrip', slot: 'grip', name: '총검 손잡이', stats: {}, perk: 'bayonetGrip', stone: true, cost: { scrap: 4, remains: 1 } },
  { id: 'doubleTap', slot: 'grip', name: '연발 손잡이', stats: {}, perk: 'doubleTap', stone: true, cost: { scrap: 3, relic: 2 } },
  { id: 'plating', slot: 'chest', name: '강화 판', stats: { maxHp: 6 }, stone: false, cost: { scrap: 6 } },
  { id: 'soulWeave', slot: 'chest', name: '영혼 직조', stats: {}, perk: 'soulWeave', stone: true, cost: { soul: 5 } },
  { id: 'reactive', slot: 'chest', name: '반응 장갑', stats: {}, perk: 'reactive', stone: true, cost: { scrap: 4, remains: 2 } },
  { id: 'servoArms', slot: 'arms', name: '서보 팔', stats: { meleeDmg: 2 }, stone: false, cost: { scrap: 4, soul: 2 } },
  { id: 'hookArms', slot: 'arms', name: '갈고리 팔', stats: {}, perk: 'hookArms', stone: true, cost: { scrap: 5, relic: 1 } },
  { id: 'shockArms', slot: 'arms', name: '충격 팔', stats: {}, perk: 'shockArms', stone: true, cost: { soul: 3, remains: 2 } },
  { id: 'sprintLegs', slot: 'legs', name: '질주 다리', stats: { evasion: 0.05 }, stone: false, cost: { soul: 3 } },
  { id: 'chargeLegs', slot: 'legs', name: '돌격 다리', stats: {}, perk: 'chargeLegs', stone: true, cost: { scrap: 4, soul: 2 } },
  { id: 'silentLegs', slot: 'legs', name: '무음 다리', stats: {}, perk: 'silentLegs', stone: true, cost: { soul: 3, relic: 2 } },
  { id: 'silencer', slot: 'back', name: '소음 차폐', stats: { noise: -2 }, stone: false, cost: { relic: 3, remains: 1 } },
  { id: 'regenPack', slot: 'back', name: '재생기', stats: {}, perk: 'regenPack', stone: true, cost: { soul: 4, remains: 2 } },
  { id: 'elemTank', slot: 'back', name: '원소 탱크', stats: {}, perk: 'elemTank', stone: true, cost: { relic: 3, remains: 2 } },
];
export const hasPerk = (h: Hero, perk: PerkId): boolean => h.perks?.includes(perk) ?? false;
export function fittedPerks(fitted: Partial<Record<ModSlot, string>>): PerkId[] {
  return Object.entries(fitted).flatMap(([slot, id]) => {
    const mod = MODS.find(m => m.id === id && m.slot === slot);
    return mod?.perk ? [mod.perk] : [];
  });
}

export function canCraft(m: MetaState, id: string): boolean {
  const mod = MODS.find(mod => mod.id === id);
  return !!mod && m.repairs.includes('workbench') && mod.slot !== 'heart' && (!mod.stone || (m.mods.unlocked ?? []).includes(id))
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
  if (!(slot === 'heart' ? (m.mods.unlocked ?? []).includes(id) : m.mods.owned.includes(id)) || !MODS.some(mod => mod.id === id && mod.slot === slot)) return false;
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
  h.baseMods = { ...m.mods.fitted }; h.sockets = {};
  h.perks = fittedPerks(m.mods.fitted);
  floorPerks(h);
  const stats = modStats(m.mods.fitted); h.modStats = stats;
  h.maxHp += stats.maxHp ?? 0; h.hp = h.maxHp;
  h.maxCharge += stats.maxCharge ?? 0; h.charge = h.maxCharge;
  h.shield = (h.shield ?? 0) + (stats.shield ?? 0);
  for (const stat of ['gunDmg', 'meleeDmg', 'evasion'] as const) h.bonus[stat] += stats[stat] ?? 0;
}

/** Sockets override exactly one base slot; never stack both mods. */
export function effectiveMods(base: Partial<Record<ModSlot, string>>, sockets: Partial<Record<ModSlot, string>>): Partial<Record<ModSlot, string>> {
  return { ...base, ...Object.fromEntries(Object.entries(sockets).flatMap(([slot, id]) => {
    const mod = stoneMod(id); return mod?.slot === slot ? [[slot, mod.id]] : [];
  })) };
}
/** Apply only the equipment delta, preserving level and upgrade bonuses and current damage. */
export function replaceMods(h: Hero, before: Partial<Record<ModSlot, string>>, after: Partial<Record<ModSlot, string>>): void {
  applyStatDelta(h, modStats(before), modStats(after));
  h.perks = fittedPerks(after);
}
export function applyStatDelta(h: Hero, old: Partial<Record<ModStat, number>>, next: Partial<Record<ModStat, number>>): void {
  const stats = h.modStats ??= {};
  const delta = (k: ModStat) => (next[k] ?? 0) - (old[k] ?? 0);
  for (const k of new Set([...Object.keys(old), ...Object.keys(next)] as ModStat[])) stats[k] = (stats[k] ?? 0) + delta(k);
  h.maxHp += delta('maxHp'); h.hp = Math.min(h.hp, h.maxHp);
  h.maxCharge += delta('maxCharge'); h.charge = Math.min(h.charge, h.maxCharge);
  h.shield = Math.max(0, (h.shield ?? 0) + delta('shield'));
  for (const k of ['gunDmg', 'meleeDmg', 'evasion'] as const) h.bonus[k] += delta(k);
}
