import { MATERIALS, type Material } from './materials';
import { canCraft, MODS, modStats, type ModDef, type ModSlot, type ModStat } from './mods';
import type { MetaState } from './meta';
import { HERO } from './types';
import { WEAPONS } from './items';
export interface WorkbenchSlot { slot: ModSlot; part: 'pistol' | 'suit'; label: string; fitted: ModDef | null }
export interface WorkbenchOption { mod: ModDef; locked: boolean; owned: boolean; craftable: boolean; missing: Partial<Record<Material, number>>; fitted: boolean }
export interface WorkbenchModel {
  open: boolean;
  materials: Record<Material, number>;
  slots: WorkbenchSlot[];
  options(slot: ModSlot): WorkbenchOption[];
  stats(preview?: { slot: ModSlot; mod: string | null }): { label: string; now: number; next?: number }[];
}
const LABEL: Record<ModSlot, string> = { barrel: '총열', mag: '탄창', sight: '조준기', grip: '손잡이', chest: '흉갑', arms: '팔', legs: '다리', back: '등 장치', heart: '핵' };
const PISTOL: ModSlot[] = ['barrel', 'mag', 'sight', 'grip'];
/** A detached snapshot: rendering and previewing never change persistent state. */
export function workbenchModel(meta: MetaState): WorkbenchModel {
  const m = structuredClone(meta);
  const find = (id?: string) => structuredClone(MODS.find(mod => mod.id === id) ?? null);
  const damage = WEAPONS.bow.dmg[0];
  const base: [string, ModStat, number][] = [
    ['피해', 'gunDmg', (damage[0] + damage[1]) / 2], ['명중', 'hit', WEAPONS.bow.hit],
    ['충전', 'maxCharge', 10 + 2 * m.facilities.chargePlus], ['소음', 'noise', 4],
    ['체력', 'maxHp', HERO.hp], ['회피', 'evasion', 0.1], ['보호막', 'shield', 0],
  ];
  return {
    open: m.repairs.includes('workbench'), materials: { ...m.materials },
    slots: (Object.keys(LABEL) as ModSlot[]).filter(slot => slot !== 'heart').map(slot => ({ slot, label: LABEL[slot], part: PISTOL.includes(slot) ? 'pistol' : 'suit', fitted: find(m.mods.fitted[slot]) })),
    options: slot => MODS.filter(mod => mod.slot === slot && slot !== 'heart').map(mod => {
      const missing: Partial<Record<Material, number>> = {};
      for (const mat of MATERIALS) if (m.materials[mat] < (mod.cost[mat] ?? 0)) missing[mat] = mod.cost[mat]! - m.materials[mat];
      return { mod: structuredClone(mod), locked: mod.stone && !(m.mods.unlocked ?? []).includes(mod.id), owned: m.mods.owned.includes(mod.id), craftable: canCraft(m, mod.id), missing, fitted: m.mods.fitted[slot] === mod.id };
    }),
    stats: preview => {
      const now = modStats(m.mods.fitted);
      const next = preview ? modStats({ ...m.mods.fitted, [preview.slot]: preview.mod ?? undefined }) : undefined;
      return base.map(([label, stat, n]) => ({ label, now: n + (now[stat] ?? 0), ...(next ? { next: n + (next[stat] ?? 0) } : {}) }));
    },
  };
}
