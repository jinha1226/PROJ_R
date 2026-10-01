import type { ClassId, TacticId } from './types';

type Col = 0 | 1 | 2;
type Row = 0 | 1 | 2 | 3;

export interface AllyPresetMember {
  classId: ClassId;
  col: Col;
  row: Row;
  tactics: TacticId[];
  color: string;
  name: string;
}

export interface EnemyPresetMember {
  enemyId: string;
  col: Col;
  row: Row;
}

const m = (classId: ClassId, col: Col, row: Row, tactics: TacticId[], color: string, name: string): AllyPresetMember =>
  ({ classId, col, row, tactics, color, name });
const e = (enemyId: string, col: Col, row: Row): EnemyPresetMember => ({ enemyId, col, row });

export const ALLY_PRESETS: Record<string, AllyPresetMember[]> = {
  solo: [m('novice', 2, 1, ['vanguard'], '#e0c04a', '이름 없는 모험가')],
  standard: [
    m('warrior', 2, 1, ['guardBack'], '#4aa3e0', '브란'),
    m('berserker', 2, 2, ['vanguard'], '#e05a4a', '카엘'),
    m('crossbow', 0, 1, ['keepDistance'], '#6ac46a', '리아'),
    m('mage', 0, 2, ['keepDistance'], '#b07ae0', '세린'),
    m('priest', 1, 1, ['weakHunt'], '#f0f0f0', '오웬'),
  ],
  elemental: [
    m('mage', 0, 1, ['keepDistance'], '#b07ae0', '세린'),
    m('priest', 1, 2, ['keepDistance'], '#f0f0f0', '오웬'),
    m('rogue', 2, 0, ['markHunt'], '#e0884a', '유나'),
    m('warrior', 2, 2, ['guardBack'], '#4aa3e0', '브란'),
    m('crossbow', 0, 2, ['keepDistance'], '#6ac46a', '리아'),
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
  empty: { stage: 1, members: [] },
};
