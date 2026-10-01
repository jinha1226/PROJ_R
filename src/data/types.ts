export type ClassId = 'novice' | 'warrior' | 'berserker' | 'rogue' | 'crossbow' | 'mage' | 'priest';
export type Role = 'vanguard' | 'striker' | 'skirmisher' | 'ranged' | 'caster' | 'support';
export type TagId = 'marked' | 'knockdown' | 'wet' | 'stun' | 'burn' | 'bleed' | 'slow' | 'shield' | 'taunted';
export type TacticId =
  | 'weakHunt'
  | 'guardBack'
  | 'casterHunt'
  | 'keepDistance'
  | 'markHunt'
  | 'vanguard'
  | 'dangerFirst'
  | 'rescueDowned'
  | 'useCover'
  | 'followLeader';
export type ModelId =
  | 'Knight'
  | 'Barbarian'
  | 'Mage'
  | 'Rogue'
  | 'Rogue_Hooded'
  | 'Skeleton_Warrior'
  | 'Skeleton_Mage'
  | 'Skeleton_Rogue'
  | 'Skeleton_Minion';
export type AnimKey =
  | 'idle'
  | 'run'
  | 'walkBack'
  | 'attack1h'
  | 'attack1hStab'
  | 'attack2h'
  | 'attack2hSpin'
  | 'attackDual'
  | 'shoot1h'
  | 'shoot2h'
  | 'cast'
  | 'castRaise'
  | 'castLong'
  | 'block'
  | 'hit'
  | 'dodgeL'
  | 'dodgeR'
  | 'dodgeB'
  | 'death'
  | 'downed'
  | 'standUp'
  | 'cheer'
  | 'throw'
  | 'spawn'
  | 'taunt'
  | 'leapChop';

export type TraitId =
  | 'reckless' | 'cautious' | 'protective' | 'coward' | 'competitive' | 'vengeful'
  | 'hotheaded' | 'calm' | 'glory' | 'loner' | 'chatty' | 'altruist';
export type EmotionId = 'rage' | 'fear' | 'elation' | 'revenge' | 'resolve' | 'courage';
export type RelationKind = 'friend' | 'comrade' | 'rival' | 'feud' | 'mentor';
export type RelationTriggerKind = 'protect' | 'rivalry' | 'revenge' | 'courage' | 'combo' | 'feud' | 'mentor';

export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  moveSpeed: number;
  dodge: number;
  crit: number;
}

export type AreaShape =
  | { shape: 'circle'; radius: number; center: 'self' | 'target' }
  | { shape: 'cone'; radius: number; angleDeg: number }
  | { shape: 'line'; length: number; width: number };

export type Effect =
  | { type: 'damage'; mult: number }
  /** mult × caster atk */
  | { type: 'heal'; mult: number }
  /** burn/bleed: value = damage per second as a multiple of the caster's atk */
  | { type: 'addTag'; tag: TagId; duration: number; value?: number }
  | { type: 'knockback'; distance: number }
  /** caster moves toward the target */
  | { type: 'dash'; distance: number; stopShort?: number }
  /** fraction of the receiver's maxHp */
  | { type: 'shield'; pctMaxHp: number; duration: number }
  | { type: 'taunt'; duration: number }
  | { type: 'cleanse' }
  | { type: 'summon'; enemyId: string; count: number };

export interface Reaction {
  tag: TagId;
  consume: boolean;
  effects: Effect[];
}

export type TargetKind = 'enemy' | 'ally' | 'self';
export type AiHint = 'heal' | 'shield' | 'cc' | 'aoe' | 'gapClose' | 'execute' | 'taunt' | 'summon';
export type ProjectileVisual = 'bolt' | 'arrow' | 'fireball' | 'holy' | 'dark';

export interface SkillDef {
  id: string;
  kind: 'basic' | 'active' | 'ultimate';
  /** seconds */
  cooldown: number;
  windup: number;
  active: number;
  recovery: number;
  range: number;
  target: TargetKind;
  area?: AreaShape;
  telegraph?: boolean;
  projectile?: { speed: number; visual: ProjectileVisual };
  effects: Effect[];
  /** applied to the caster when the skill fires */
  selfEffects?: Effect[];
  reacts?: Reaction[];
  anim: AnimKey;
  aiValue: number;
  hints?: AiHint[];
}

export interface GearVisual {
  weapon: string;
  offhand?: string;
  helmet: boolean;
  cape: boolean;
}

export interface ClassDef {
  id: ClassId;
  role: Role;
  base: Stats;
  growth: Partial<Stats>;
  basic: string;
  actives: string[];
  ultimate: string;
  model: ModelId;
  gear: GearVisual;
}

export interface BossPhase {
  hpBelow: number;
  statMult: Partial<Stats>;
  areaMult: number;
}

export interface EnemyDef {
  id: string;
  role: Role;
  base: Stats;
  basic: string;
  actives: string[];
  ultimate?: string;
  model: ModelId;
  gear: GearVisual;
  tint?: string;
  scale?: number;
  elite?: boolean;
  boss?: boolean;
  phases?: BossPhase[];
}

export interface Relation {
  a: string;
  b: string;
  affinity: number;
  rival: boolean;
  battlesTogether: number;
  /** last-hit contests counted toward rivalry */
  contests: number;
}

export interface TraitDef {
  id: TraitId;
  affinityMult: number;
  likes: TraitId[];
  dislikes: TraitId[];
}

export interface EmotionDef {
  id: EmotionId;
  durationSec: number;
  statMult: Partial<Stats>;
  momentumMult: number;
}

export interface ComboDef {
  id: string;
  classes: [ClassId, ClassId];
  lead: ClassId;
  skill: string;
  partnerSkill: string;
  /** seconds */
  cooldown: number;
}
