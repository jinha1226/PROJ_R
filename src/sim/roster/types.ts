import type { ClassId, ItemSlot, MercRecord, Relation, ScarId, TacticId, TitleId, TraitId } from '../../data/types';

export type Rank = 'rookie' | 'skilled' | 'veteran' | 'hero';

export interface ChronicleEntry {
  battle: number;
  key: string;
  vars: Record<string, string | number>;
}

export interface Mercenary {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  color: string;
  backstory: string;
  traits: TraitId[];
  revealed: TraitId[];
  /** fixed per-mercenary growth variance (0.85–1.15) */
  growth: { maxHp: number; atk: number; def: number };
  actives: string[];
  ultimate: string;
  passives: string[];
  skillLevels: Record<string, number>;
  tactics: TacticId[];
  gear: Partial<Record<ItemSlot, string>>;
  /** battles of injury remaining */
  injury: number;
  scars: ScarId[];
  title?: TitleId;
  tempTraits: { trait: TraitId; battles: number }[];
  chronicle: ChronicleEntry[];
  record: MercRecord;
  alive: boolean;
  pendingLevelUps: number;
  protagonist?: boolean;
}

export interface Roster {
  seed: number;
  battles: number;
  nextId: number;
  mercs: Mercenary[];
  memorial: Mercenary[];
  relations: Relation[];
  inventory: string[];
  tacticsOwned: TacticId[];
}

export const MAX_LEVEL = 10;

export function rankOf(level: number): Rank {
  return level >= 10 ? 'hero' : level >= 7 ? 'veteran' : level >= 4 ? 'skilled' : 'rookie';
}

export const emptyRecord = (): MercRecord => ({ battles: 0, kills: 0, rescues: 0, downedSurvived: 0, bossKills: 0, dodges: 0, healing: 0 });
