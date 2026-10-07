import { COMMON_CARDS, KEYSTONE_CARDS } from './cardsCommon';
import { ARCHER_CARDS } from './cardsArcher';
import { CLERIC_CARDS } from './cardsCleric';
import { SUPPORT_CARDS } from './cardsSupport';
import { SHELL_CARDS } from './cardsShell';
import { MAGE_CARDS } from './cardsMage';
import { NECRO_CARDS } from './cardsNecro';
import { ROGUE_CARDS } from './cardsRogue';
import { WARRIOR_CARDS } from './cardsWarrior';
import type { TraitDef } from './traitTypes';
export { rank, type Mods, type Tag, type TraitDef } from './traitTypes';
export type TraitId = string;
export const MAX_RANK=3;

// The card files import combat code that imports this table back, so the table is built on first use, not while modules load.
let table: Record<string, TraitDef> | undefined;
const all = (): Record<string, TraitDef> => (table ??= Object.fromEntries([...COMMON_CARDS, ...WARRIOR_CARDS, ...ARCHER_CARDS, ...CLERIC_CARDS, ...SUPPORT_CARDS, ...SHELL_CARDS, ...MAGE_CARDS, ...NECRO_CARDS, ...ROGUE_CARDS, ...KEYSTONE_CARDS].map((d) => [d.id, d])));
/** every card: common, the five classes, the empty body, cleric support and duos, oaths */
export const TRAITS: Record<string, TraitDef> = new Proxy({} as Record<string, TraitDef>, {
  get: (_t, k) => (typeof k === 'string' ? all()[k] : undefined),
  set: (_t, k, v) => { all()[k as string] = v as TraitDef; return true; },
  deleteProperty: (_t, k) => { delete all()[k as string]; return true; },
  has: (_t, k) => k in all(),
  ownKeys: () => Reflect.ownKeys(all()),
  getOwnPropertyDescriptor: (_t, k) => (k in all() ? { value: all()[k as string], writable: true, enumerable: true, configurable: true } : undefined),
});
