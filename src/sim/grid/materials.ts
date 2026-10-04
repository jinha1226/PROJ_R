import type { GridState } from './types';
export type Material = 'scrap' | 'soul' | 'relic' | 'remains';
export type Materials = Record<Material, number>;
export const MATERIAL_NAME: Record<Material, string> = { scrap: '고철', soul: '영혼 결정', relic: '고대 부품', remains: '정예 잔해' };
export const emptyMaterials = (): Materials => ({ scrap: 0, soul: 0, relic: 0, remains: 0 });
export const MATERIALS = Object.keys(MATERIAL_NAME) as Material[];
export const zoneMaterial = (floor: number): Exclude<Material, 'remains'> => floor <= 5 ? 'scrap' : floor <= 10 ? 'soul' : 'relic';
export function dropChance(meta: { materials: Materials }, mat: Material, base = 0.25): number {
  return Math.min(1, base * (meta.materials[mat] < 5 ? 1.5 : 1));
}
export function gainMaterial(s: GridState, t: number, mat: Material, n: number): void {
  s.run.materials[mat] += n;
  s.events.push({ t, type: 'pickup', src: s.hero.id, text: MATERIAL_NAME[mat], amount: n });
}
export const afford = (stock: Materials, cost: Partial<Materials>): boolean => MATERIALS.every(mat => stock[mat] >= (cost[mat] ?? 0));
export function spend(stock: Materials, cost: Partial<Materials>): void {
  for (const mat of MATERIALS) stock[mat] -= cost[mat] ?? 0;
}
