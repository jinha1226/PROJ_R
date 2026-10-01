import type { Theme } from '../run/types';

/** Enemy pools and cover props per region theme (prop kinds map to view theme kits). */
export const THEME_ENEMIES: Record<Theme, { pool: string[]; elite: string[] }> = {
  forest: { pool: ['bandit_cutthroat', 'bandit_cutthroat', 'bandit_archer', 'bandit_hexer'], elite: ['bandit_chief'] },
  dungeon: { pool: ['skeleton_minion', 'skeleton_warrior', 'skeleton_archer', 'skeleton_minion'], elite: ['skeleton_warrior', 'skeleton_mage'] },
  graveyard: { pool: ['skeleton_minion', 'skeleton_mage', 'skeleton_archer', 'skeleton_warrior'], elite: ['skeleton_mage', 'skeleton_mage'] },
};

export const THEME_PROPS: Record<Theme, { kind: string; r: number }[]> = {
  forest: [{ kind: 'tree', r: 0.9 }, { kind: 'rock', r: 0.8 }, { kind: 'bush', r: 0.6 }],
  dungeon: [{ kind: 'pillar', r: 0.7 }, { kind: 'crates', r: 0.8 }, { kind: 'barrel', r: 0.6 }],
  graveyard: [{ kind: 'grave', r: 0.6 }, { kind: 'deadtree', r: 0.8 }, { kind: 'crypt', r: 1.0 }],
};
