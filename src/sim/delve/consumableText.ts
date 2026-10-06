import type { ConsumableId } from './catalog';

/** What each consumable does, in a line (thrown ones land within 8 cells; "주변 1칸" hits everyone there, clones too). */
export const CONSUMABLE_TEXT: Record<ConsumableId, string> = {
  potion: '체력 40% 회복',
  rage: '5턴 동안 피해 +40%',
  cleanse: '아군 전원 상태이상 해제',
  boltWand: '직선 관통 번개 · 피해 10 · 감전 · 3회',
  smoke: '주변 1칸 · 아군 2턴 은신 · 적 2턴 실명',
  fireBomb: '주변 1칸 피해 8 · 화상 · 아군 포함',
  iceBomb: '주변 1칸 빙결 · 아군 포함',
  poisonJar: '주변 1칸 중독 3중첩 · 아군 포함',
};
