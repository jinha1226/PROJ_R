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
export type ChannelKind = 'search' | 'extract' | 'recall' | 'equip';
export interface Channel { kind: ChannelKind; ticks: number; total: number; target?: string; index?: number; member?: string; waiting?: boolean }

export interface WorldEvent { tick: number; type: string; data?: Record<string, unknown> }

export interface HeroState {
  merc: Mercenary;
  loadout: Loadout;
  channel?: Channel;
  /** a potion being drunk: its own timer, so it never interrupts recall or extraction */
  drink?: { ticks: number; total: number; item: string };
  poisonImmuneUntil: number;
  hiddenUntil: number;
  /** hp seen last tick, to notice damage (cancels channels) */
  lastHp: number;
  /** last tick anyone in the party took or dealt damage (breath recovery waits for calm) */
  lastCombat: number;
  /** each member's hp last tick (a hit on anyone sets the extraction gauge back) */
  memberHp: Record<string, number>;
}

/** The party on a sortie: order (leader first), who they are, what they wear, and how they move. */
export interface PartyState {
  order: string[];
  mercs: Record<string, Mercenary>;
  gear: Record<string, Loadout>;
  mode: 'explore' | 'combat';
  /** ticks since the last sign of combat (explore resumes after a grace period) */
  calmTicks: number;
  command?: { kind: 'retreat' | 'regroup'; until: number; dir?: Vec2 };
  focus?: string;
  /** leader footprints, newest last (followers queue along it in narrow places) */
  trail: Vec2[];
  dead: string[];
  /** per-follower route state */
  follow: Record<string, { path?: Vec2[]; repathIn: number; crumb?: Vec2; leashed?: boolean }>;
  /** gear the fallen wore (kept for the record; it lies on their bodies) */
  lost?: Record<string, Loadout>;
  /** how the party got out: an extraction point id, or 'recall' */
  exitVia?: string;
  /** tick of the last focus order (an ambush counts as a fight for a moment even before anyone notices) */
  focusAt: number;
  /** the player is steering the leader this tick (the leader leaves the AI while the stick is held) */
  leaderSteered: boolean;
}

/** The whole sortie: the battle state of every unit plus the region-level rules around it. */
export interface WorldState {
  seed: number;
  b: BattleState;
  region: Region;
  nav: NavGrid;
  /** the current leader (the unit the player steers) */
  heroId: string;
  party: PartyState;
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
  outcome: 'extracted' | 'failed' | null;
  xp: number;
  nextSpawn: number;
}
