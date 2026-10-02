import type { Theme } from '../sim/run/types';
import { EnvLibrary } from '../view/explore/envAssets';

const cache = new Map<Theme, Promise<EnvLibrary>>();

export function getEnv(theme: Theme): Promise<EnvLibrary> {
  let p = cache.get(theme);
  if (!p) {
    p = EnvLibrary.load(import.meta.env.BASE_URL, theme).catch((e: unknown) => { cache.delete(theme); throw e; });
    cache.set(theme, p);
  }
  return p;
}

/** Every env model an extraction region can use. */
export const WORLD_REFS = [
  'forest/tree', 'forest/treeB', 'forest/trees', 'forest/treesB', 'forest/rock', 'forest/rockB', 'forest/bush',
  'dungeon/pillar', 'dungeon/crates', 'dungeon/barrel', 'dungeon/torch', 'dungeon/chest', 'dungeon/rubble', 'dungeon/wall',
  'graveyard/grave', 'graveyard/graveB', 'graveyard/deadtree', 'graveyard/deadtreeB', 'graveyard/crypt', 'graveyard/arch', 'graveyard/lantern',
];
let world: Promise<EnvLibrary> | null = null;

export function getWorldEnv(): Promise<EnvLibrary> {
  world ??= EnvLibrary.loadRefs(import.meta.env.BASE_URL, WORLD_REFS).catch((e: unknown) => { world = null; throw e; });
  return world;
}

/** The crypt kit the grid sortie draws with. */
export const GRID_REFS = ['dungeon/floor', 'dungeon/wall', 'dungeon/torch', 'dungeon/pillar', 'dungeon/chest', 'dungeon/barrel', 'dungeon/crates'];
let grid: Promise<EnvLibrary> | null = null;

export function getGridEnv(): Promise<EnvLibrary> {
  grid ??= EnvLibrary.loadRefs(import.meta.env.BASE_URL, GRID_REFS).catch((e: unknown) => { grid = null; throw e; });
  return grid;
}
