import type { ItemKind } from './types';

/** What a roll draws from: an item kind, and a tier offset from the container's tier. */
export interface LootEntry { kind: ItemKind | 'potion' | 'herbal'; weight: number; tierOffset?: number }
export interface LootTable { rolls: [number, number]; entries: LootEntry[]; guaranteed?: LootEntry[] }

export const CONTAINER_LOOT: Record<'crate' | 'supply' | 'relic' | 'bag' | 'herb' | 'vault', LootTable> = {
  crate: { rolls: [2, 3], entries: [{ kind: 'junk', weight: 55 }, { kind: 'part', weight: 15 }, { kind: 'potion', weight: 15 }, { kind: 'gear', weight: 15, tierOffset: -1 }] },
  supply: { rolls: [2, 4], entries: [{ kind: 'potion', weight: 50 }, { kind: 'consumable', weight: 25 }, { kind: 'junk', weight: 25 }] },
  relic: { rolls: [1, 2], guaranteed: [{ kind: 'relic', weight: 1 }], entries: [{ kind: 'junk', weight: 40, tierOffset: 1 }, { kind: 'gear', weight: 60 }] },
  bag: { rolls: [2, 3], entries: [{ kind: 'gear', weight: 40, tierOffset: -1 }, { kind: 'potion', weight: 30 }, { kind: 'junk', weight: 30 }] },
  herb: { rolls: [1, 2], entries: [{ kind: 'herbal', weight: 60 }, { kind: 'junk', weight: 40, tierOffset: -1 }] },
  vault: { rolls: [2, 3], guaranteed: [{ kind: 'relic', weight: 1 }], entries: [{ kind: 'junk', weight: 50, tierOffset: 1 }, { kind: 'gear', weight: 35, tierOffset: 1 }, { kind: 'relic', weight: 15 }] },
};

/** Enemy drops: item id, chance, count range. */
export const ENEMY_DROPS: Record<string, { id: string; chance: number; n: [number, number] }[]> = {
  bandit: [{ id: 'x_badge', chance: 0.6, n: [1, 2] }, { id: 'x_coins', chance: 0.3, n: [1, 1] }, { id: 'x_potion_s', chance: 0.15, n: [1, 1] }],
  bandit_chief: [{ id: 'x_chief_seal', chance: 1, n: [1, 1] }, { id: 'x_coins', chance: 1, n: [2, 3] }],
  skeleton: [{ id: 'x_bone', chance: 0.7, n: [1, 3] }, { id: 'x_bonedust', chance: 0.3, n: [1, 2] }, { id: 'x_soulstone', chance: 0.1, n: [1, 1] }],
  skeleton_elite: [{ id: 'x_bonedust', chance: 0.6, n: [1, 2] }, { id: 'x_soulstone', chance: 0.25, n: [1, 1] }],
  ashen_knight: [{ id: 'x_ash_core', chance: 1, n: [1, 1] }],
};
/** chance of a gear piece on any enemy, by enemy family */
export const ENEMY_GEAR_CHANCE: Record<string, number> = { bandit: 0.08, bandit_chief: 1, skeleton: 0.04, skeleton_elite: 0.12, ashen_knight: 1 };
