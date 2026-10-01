import type { Mercenary, Roster } from '../roster/types';

export type NodeType = 'battle' | 'elite' | 'encounter' | 'event' | 'rest' | 'shop' | 'boss';

export interface MapNode {
  id: string;
  step: number;
  lane: 0 | 1 | 2;
  type: NodeType;
  next: string[];
}

export interface RunMap {
  nodes: Record<string, MapNode>;
  steps: number;
}

export type RunStatus = 'active' | 'won' | 'lost';
export type Slot = { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 };

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

/** Per-node state persisted while the player is inside a node (so reloads keep stock/candidates). */
export interface PendingNode {
  nodeId: string;
  candidates?: Candidate[];
  shop?: ShopStock;
  event?: EventView;
}

export interface RunState {
  version: 1;
  seed: number;
  gold: number;
  roster: Roster;
  map: RunMap;
  at: string | null;
  visited: string[];
  status: RunStatus;
  companyName?: string;
  formation: Record<string, Slot>;
  pending?: PendingNode;
  startedAt: string;
  namedProtagonist: boolean;
}
