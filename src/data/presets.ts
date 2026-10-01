import type { ClassId, Relation, TacticId, TraitId } from './types';

type Col = 0 | 1 | 2;
type Row = 0 | 1 | 2 | 3;

export interface AllyPresetMember {
  classId: ClassId;
  col: Col;
  row: Row;
  tactics: TacticId[];
  color: string;
  name: string;
  traits?: TraitId[];
  level?: number;
}

export interface EnemyPresetMember {
  enemyId: string;
  col: Col;
  row: Row;
}

const m = (
  classId: ClassId, col: Col, row: Row, tactics: TacticId[], color: string, name: string, traits: TraitId[] = [], level = 1,
): AllyPresetMember => ({ classId, col, row, tactics, color, name, traits, level });
const rel = (a: string, b: string, affinity: number, extra: Partial<Relation> = {}): Relation =>
  ({ a, b, affinity, rival: false, battlesTogether: 0, contests: 0, ...extra });
const e = (enemyId: string, col: Col, row: Row): EnemyPresetMember => ({ enemyId, col, row });

export const ALLY_PRESETS: Record<string, AllyPresetMember[]> = {
  solo: [m('novice', 2, 1, ['vanguard'], '#e0c04a', '이름 없는 모험가')],
  standard: [
    m('warrior', 2, 1, ['guardBack'], '#4aa3e0', '브란', ['protective']),
    m('berserker', 2, 2, ['vanguard'], '#e05a4a', '카엘', ['hotheaded']),
    m('crossbow', 0, 1, ['keepDistance'], '#6ac46a', '리아', ['cautious']),
    m('mage', 0, 2, ['keepDistance'], '#b07ae0', '세린', ['chatty']),
    m('priest', 1, 1, ['weakHunt'], '#f0f0f0', '오웬', ['altruist']),
  ],
  bonds: [
    m('warrior', 2, 1, ['guardBack'], '#4aa3e0', '브란', ['protective', 'calm'], 5),
    m('priest', 1, 1, ['weakHunt'], '#f0f0f0', '오웬', ['altruist', 'coward']),
    m('berserker', 2, 2, ['vanguard'], '#e05a4a', '카엘', ['competitive', 'hotheaded']),
    m('rogue', 2, 0, ['weakHunt'], '#e0884a', '유나', ['competitive', 'reckless']),
    m('mage', 0, 2, ['keepDistance'], '#b07ae0', '세린', ['vengeful', 'chatty']),
  ],
  elemental: [
    m('mage', 0, 1, ['keepDistance'], '#b07ae0', '세린'),
    m('priest', 1, 2, ['keepDistance'], '#f0f0f0', '오웬'),
    m('rogue', 2, 0, ['markHunt'], '#e0884a', '유나'),
    m('warrior', 2, 2, ['guardBack'], '#4aa3e0', '브란'),
    m('crossbow', 0, 2, ['keepDistance'], '#6ac46a', '리아'),
  ],
};

/** Relationships between preset members (ids a0.. by member index). */
export const ALLY_RELATIONS: Record<string, Relation[]> = {
  bonds: [
    rel('a0', 'a1', 60),
    rel('a2', 'a3', 10, { rival: true }),
    rel('a0', 'a4', 85, { battlesTogether: 12 }),
    rel('a3', 'a4', -50),
  ],
};

export const ENEMY_PRESETS: Record<string, { stage: number; members: EnemyPresetMember[] }> = {
  tutorial: { stage: 1, members: [e('skeleton_minion', 2, 0), e('skeleton_minion', 2, 1), e('skeleton_minion', 2, 2)] },
  bandits: {
    stage: 1,
    members: [
      e('bandit_cutthroat', 2, 1), e('bandit_cutthroat', 2, 2),
      e('bandit_archer', 0, 1), e('bandit_archer', 0, 2), e('bandit_hexer', 1, 1),
    ],
  },
  skeletons: {
    stage: 3,
    members: [
      e('skeleton_warrior', 2, 1), e('skeleton_warrior', 2, 2), e('skeleton_minion', 2, 0),
      e('skeleton_minion', 2, 3), e('skeleton_archer', 0, 1), e('skeleton_mage', 0, 2),
    ],
  },
  boss: {
    stage: 12,
    members: [e('ashen_knight', 1, 1), e('skeleton_archer', 0, 0), e('skeleton_archer', 0, 3)],
  },
  ambush: {
    stage: 4,
    members: [
      e('bandit_chief', 2, 1), e('bandit_cutthroat', 2, 0), e('bandit_cutthroat', 2, 2), e('bandit_cutthroat', 2, 3),
      e('bandit_archer', 0, 1), e('bandit_archer', 0, 2), e('bandit_hexer', 1, 0),
    ],
  },
  empty: { stage: 1, members: [] },
};
