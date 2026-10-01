import { createProtagonist, generateRecruit } from '../../../src/sim/roster/generate';
import { createRng } from '../../../src/core/rng';
import { emptyLoadout, type Loadout } from '../../../src/sim/extract/loadout';
import type { Region, Spawn } from '../../../src/sim/extract/region';
import type { Obstacle } from '../../../src/sim/battle/types';
import { REGION_BOUNDS } from '../../../src/sim/extract/region';

/** A hand-made region for focused world tests. */
export function testRegion(spawns: Spawn[], extra: Partial<Region> = {}, obstacles: Obstacle[] = []): Region {
  return {
    seed: 1, layout: 'cross', bounds: REGION_BOUNDS, obstacles, props: [], decor: [], pois: [], containers: [], spawns,
    extracts: [{ id: 'x0', pos: { x: 50, y: 0 }, radius: 2.5 }], hazards: [], start: { x: 0, y: 0 }, ...extra,
  };
}

export const spawn = (id: string, x: number, y: number, group = 'g1', enemyId = 'skeleton_minion', patrol?: { x: number; y: number }[]): Spawn =>
  ({ id, enemyId, pos: { x, y }, stage: 1, group, patrol });

export const hero = () => createProtagonist(5);
export const kit = (): Loadout => ({ ...emptyLoadout(), equipped: { weapon: 'x_sword_shield_1', chest: 'x_chest_1' } });

/** A ready party: warrior, mage, priest, crossbow, berserker (level 3, no gear). */
export const crew = (n: number) => {
  const rng = createRng(3);
  const used = new Set<string>();
  return Array.from({ length: n }, (_, i) => ({ merc: generateRecruit(rng, { level: 3, usedNames: used, id: `m${i}`, classId: (['warrior', 'mage', 'priest', 'crossbow', 'berserker'] as const)[i % 5] }), gear: { ...emptyLoadout(), equipped: {} } }));
};
