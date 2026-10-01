import type { Vec2 } from '../../core/vec2';
import type { Rng } from '../../core/rng';
import type { AreaShape, BossPhase, GearVisual, ModelId, Role, Stats, TacticId, TagId } from '../../data/types';

export type Team = 'ally' | 'enemy';
export type Line = 'front' | 'mid' | 'back';

export interface UnitSetup {
  id: string;
  name: string;
  team: Team;
  role: Role;
  /** classId or enemyId */
  defId: string;
  stats: Stats;
  basic: string;
  actives: string[];
  ultimate?: string;
  tactics: TacticId[];
  slot: { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 };
  color: string;
  model: ModelId;
  gear: GearVisual;
  tint?: string;
  scale?: number;
  isLeader?: boolean;
  elite?: boolean;
  boss?: boolean;
  phases?: BossPhase[];
  /** Extension point for later plans (traits, relationships, ...). */
  extra?: Record<string, unknown>;
}

export interface Obstacle {
  pos: Vec2;
  radius: number;
  kind: 'rock' | 'pillar';
}

export interface BattleSetup {
  seed: number;
  allies: UnitSetup[];
  enemies: UnitSetup[];
  obstacles?: Obstacle[];
}

export interface TagInstance {
  tag: TagId;
  ticksLeft: number;
  value: number;
  srcId: string;
}

export interface ActionState {
  skillId: string;
  targetId?: string;
  targetPos?: Vec2;
  phase: 'windup' | 'active' | 'recovery';
  ticksLeft: number;
  totalTicks: number;
  telegraphId?: number;
}

export type IntentKind = 'attack' | 'skill' | 'approach' | 'kite' | 'dodge' | 'rescue' | 'guard' | 'retreat' | 'idle';

export interface Intent {
  kind: IntentKind;
  skillId?: string;
  targetId?: string;
  dest?: Vec2;
  /** ko.reason key */
  reason: string;
  detail?: string[];
}

export interface ForcedMove {
  vel: Vec2;
  ticksLeft: number;
  kind: 'knockback' | 'dash' | 'roll';
}

export interface UnitState {
  id: string;
  setup: UnitSetup;
  team: Team;
  line: Line;
  pos: Vec2;
  facing: number;
  vel: Vec2;
  hp: number;
  maxHp: number;
  shield: number;
  momentum: number;
  alive: boolean;
  downed: boolean;
  lifeline: number;
  action: ActionState | null;
  cooldowns: Record<string, number>;
  tags: TagInstance[];
  intent: Intent | null;
  decisionIn: number;
  forced: ForcedMove | null;
  engagedWith: string | null;
  threat: Record<string, number>;
  rescueUsed: boolean;
  rescueProgress: number;
  rescueTarget: string | null;
  phaseIndex: number;
  summoned: boolean;
  stats: { kills: number; damageDealt: number; healingDone: number; dodges: number };
}

export interface Telegraph {
  id: number;
  srcId: string;
  skillId: string;
  team: Team;
  area: AreaShape;
  origin: Vec2;
  dir: Vec2;
  firesAt: number;
  startedAt: number;
  areaMult: number;
}

export interface Projectile {
  id: number;
  srcId: string;
  skillId: string;
  targetId: string;
  pos: Vec2;
  speed: number;
  visual: string;
}

export type Outcome = 'victory' | 'defeat' | 'retreat';
export type BattleCommand = { type: 'retreat' };

export interface BattleEvent {
  tick: number;
  type: string;
  src?: string;
  dst?: string;
  skillId?: string;
  amount?: number;
  tag?: string;
  crit?: boolean;
  reason?: string;
  pos?: Vec2;
  data?: Record<string, unknown>;
}

export interface BattleState {
  tick: number;
  rng: Rng;
  units: UnitState[];
  telegraphs: Telegraph[];
  projectiles: Projectile[];
  obstacles: Obstacle[];
  events: BattleEvent[];
  outcome: Outcome | null;
  pending: BattleCommand[];
  nextId: number;
  berserkMult: number;
}

export interface UnitSnap {
  id: string;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  shield: number;
  momentum: number;
  alive: boolean;
  downed: boolean;
  lifeline: number;
  action: { skillId: string; phase: string; progress: number } | null;
  tags: string[];
  intent: Intent | null;
  forced: string | null;
}

export interface TelegraphSnap {
  id: number;
  skillId: string;
  team: Team;
  area: AreaShape;
  origin: Vec2;
  dir: Vec2;
  progress: number;
  areaMult: number;
}

export interface Snapshot {
  tick: number;
  units: UnitSnap[];
  telegraphs: TelegraphSnap[];
  projectiles: { id: number; x: number; y: number; visual: string }[];
}

export interface StepResult {
  snapshot: Snapshot;
  events: BattleEvent[];
}
