import { afford, spend, type Material } from './materials';
import type { MetaState } from './meta';
export type ToolId = 'cutter' | 'grapple' | 'scanner';
export type SystemId = 'workbench' | 'suitlab' | 'nav' | 'lifeSupport' | 'pod' | 'core';
export const SYSTEMS: Record<SystemId, { name: string; cost: Partial<Record<Material, number>>; needs?: SystemId[]; tool?: ToolId }> = {
  workbench: { name: '작업대', cost: { scrap: 6 }, tool: 'cutter' },
  suitlab: { name: '슈트 공방', cost: { scrap: 4, soul: 4 }, tool: 'grapple' },
  nav: { name: '항법', cost: { soul: 3, relic: 3 }, needs: ['workbench'], tool: 'scanner' },
  lifeSupport: { name: '생명 유지', cost: { soul: 6, remains: 2 }, needs: ['suitlab'] },
  pod: { name: '복제 포드', cost: { relic: 4, remains: 3 }, needs: ['lifeSupport'] },
  core: { name: '차원 코어', cost: { relic: 8, remains: 5 }, needs: ['nav', 'pod'] },
};
export function canRepair(m: MetaState, id: SystemId): boolean {
  const system = SYSTEMS[id];
  return !!system && !m.repairs.includes(id) && (system.needs ?? []).every(need => m.repairs.includes(need))
    && (id !== 'core' || m.coreSecured) && afford(m.materials, system.cost);
}
export function repair(m: MetaState, id: SystemId): boolean {
  if (!canRepair(m, id)) return false;
  const system = SYSTEMS[id]; spend(m.materials, system.cost); m.repairs.push(id);
  if (system.tool && !m.tools.includes(system.tool)) m.tools.push(system.tool);
  if (id === 'core') m.departed = true;
  return true;
}
