import type { Mercenary, Roster } from '../roster/types';
import type { Moment } from '../roster/relationships';

/** Seed coordinates for per-week content (step = week, lane = which slot). */
export interface Spot {
  step: number;
  lane: number;
}

export type RunStatus = 'active' | 'won' | 'lost';
export type Slot = { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 };
export type WeekPhase = 'start' | 'choose' | 'exploring' | 'report' | 'boss';
export type Theme = 'forest' | 'dungeon' | 'graveyard';

export interface Candidate {
  merc: Mercenary;
  fee: number;
  past?: { with: string; kind: 'friend' | 'feud' | 'rival' };
}

export interface ShopStock {
  items: { itemId: string; price: number; sold?: boolean }[];
}

export interface EventChoice {
  id: string;
  textKey: string;
  actor?: string;
  available: boolean;
  reasonKey?: string;
}

export interface EventView {
  eventId: string;
  vars: Record<string, string>;
  choices: EventChoice[];
}

export interface RegionCard {
  theme: Theme;
  stars: 1 | 2 | 3;
  reward: 'gold' | 'gear' | 'xp';
  rooms: number;
}

export interface WeekReport {
  week: number;
  kind: 'train' | 'rest' | 'explore';
  deployed: string[];
  xp: Record<string, number>;
  moments: Moment[];
  notes: { key: string; vars: Record<string, string> }[];
  gold: number;
  items: string[];
}

/** Volatile "inside an action" state; a battle in progress resumes as a retreat. */
export interface PendingNode {
  inBattle?: boolean;
  event?: EventView;
}

export interface RunState {
  version: 2;
  seed: number;
  gold: number;
  roster: Roster;
  week: number;
  phase: WeekPhase;
  status: RunStatus;
  companyName?: string;
  formation: Record<string, Slot>;
  startedAt: string;
  namedProtagonist: boolean;
  visitors?: Candidate[];
  startEvent?: EventView;
  regionCards?: RegionCard[];
  exploration?: import('../explore/types').Exploration;
  shop?: { week: number; stock: ShopStock };
  report?: WeekReport;
  pending?: PendingNode;
}

export const LAST_WEEK = 12;
