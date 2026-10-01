import type { Moment } from '../roster/relationships';
import type { RegionCard, Theme } from '../run/types';

export type Dir = 'n' | 's' | 'e' | 'w';
export type RoomType = 'start' | 'battle' | 'elite' | 'chest' | 'event' | 'campfire' | 'exit';

export interface Prop {
  kind: string;
  x: number;
  y: number;
  r: number;
}

export interface Room {
  id: string;
  gx: number;
  gy: number;
  type: RoomType;
  doors: Partial<Record<Dir, string>>;
  enemies?: { enemyId: string; x: number; y: number }[];
  props: Prop[];
  done: boolean;
}

export interface Exploration {
  seed: number;
  theme: Theme;
  stars: RegionCard['stars'];
  reward: RegionCard['reward'];
  week: number;
  rooms: Record<string, Room>;
  at: string;
  visited: string[];
  enteredFrom?: Dir;
  loot: { gold: number; items: string[] };
  party: string[];
  rested: boolean;
  /** growth and stories gathered on the way, for the week report */
  gained?: { xp: Record<string, number>; moments: Moment[] };
}
