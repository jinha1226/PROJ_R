import type { Vec2 } from '../../core/vec2';
import type { BattleState } from '../battle/types';
import type { Stack } from '../extract/inventory';
import type { Loadout } from '../extract/loadout';
import type { Region } from '../extract/regionTypes';
import type { Mercenary } from '../roster/types';
import type { NavGrid } from './nav';

export type AiMode = 'idle' | 'patrol' | 'alert' | 'return';
export interface AiState { mode: AiMode; wp: number; home: Vec2; path?: Vec2[]; repathIn: number }
export interface Group { alerted: boolean; home: Vec2; members: string[]; hunter?: boolean }
export interface Pile { id: string; pos: Vec2; items: Stack[] }
export type ChannelKind = 'search' | 'extract' | 'recall' | 'equip' | 'drink';
export interface Channel { kind: ChannelKind; ticks: number; total: number; target?: string; index?: number }

export interface WorldEvent { tick: number; type: string; data?: Record<string, unknown> }

export interface HeroState {
  merc: Mercenary;
  loadout: Loadout;
  channel?: Channel;
  poisonImmuneUntil: number;
  hiddenUntil: number;
  /** hp seen last tick, to notice damage (cancels channels) */
  lastHp: number;
  /** last tick the hero took or dealt damage (breath recovery waits for calm) */
  lastCombat: number;
}

/** The whole sortie: the battle state of every unit plus the region-level rules around it. */
export interface WorldState {
  seed: number;
  b: BattleState;
  region: Region;
  nav: NavGrid;
  heroId: string;
  groups: Record<string, Group>;
  /** unit id → group id */
  groupOf: Record<string, string>;
  /** unit id → patrol route (if any) */
  routes: Record<string, Vec2[]>;
  ai: Record<string, AiState>;
  containers: Record<string, { opened: boolean; items: Stack[] }>;
  piles: Pile[];
  hero: HeroState;
  doorsOpen: string[];
  closed: string[];
  events: WorldEvent[];
  outcome: 'extracted' | 'downed' | null;
  xp: number;
  nextSpawn: number;
}
