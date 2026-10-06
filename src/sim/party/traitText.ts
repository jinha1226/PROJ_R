import { TRAITS } from './traitDefs';
import { TEXT_CLASS } from './traitTextClass';
import { TEXT_ADVANCED } from './traitTextAdvanced';
import { stepped, top, type TextFn } from './traitTextUtil';

const COMMON: Record<string, TextFn> = {
  tough: (r) => `최대 체력 +${15 * r}%`,
  sprint: (r) => `이동 +${10 * r}%${top(r, '이동 후 첫 피격 회피')}`,
  eagle: (r) => `원거리 명중 +${5 * r}%${top(r, '사거리 +1')}`,
  coverPro: (r) => `엄폐 중 받는 피해 -${15 * r}%`,
  firstAid: (r) => `전투 밖 턴당 체력 +${r}%`,
  grit: (r) => `죽을 피해를 체력 1로 버팀 (${[60, 40, 20][r - 1]}턴)`,
  bond: (r) => `대상 2칸 안 아군당 피해 +${5 * r}%`,
  resonance: (r) => `궁극기 대기 -${10 * r}%`,
  finish: (r) => `처치 → 다음 공격 피해 +${stepped(50, 25, r)}%`,
  reflex: () => '회피 → 다음 공격 치명',
  anger: (r) => `피격 → 3턴간 피해 +${10 * r}% (최대 3중첩)`,
  combo: (r) => `3번째 공격마다 추가 공격 (피해 ${stepped(100, 25, r)}%)`,
  unyielding: (r) => `위기 → 보호막 ${stepped(20, 10, r)}`,
  morale: (r) => `처치 → 2칸 안 아군 치유 ${4 * r}`,
  initiative: (r) => `전투 시작 → 첫 공격 즉시, 피해 +${20 * r}%`,
  absorb: (r) => `적중 → 피해의 ${5 * r}% 회복`,
  weakness: (r) => `치명 확률 +${5 * r}%`,
  cruel: (r) => `치명 피해 +${25 * r}%`,
  pursuit: (r) => `이동 후 공격 피해 +${15 * r}%`,
  endure: (r) => `제자리 2턴 → 받는 피해 -${10 * r}%`,
  seasoned: (r) => `경험치 +${10 * r}%`,
  plunder: (r) => `처치한 적의 생체 재료 +${25 * r}%`,
  openWound: () => '치명 → 출혈',
  spark: (r) => `적중 → ${stepped(15, 10, r)}% 확률로 화상`,
};

export const TRAIT_TEXT: Record<string, TextFn> = { ...COMMON, ...TEXT_CLASS, ...TEXT_ADVANCED };

/** Terse Korean description of a trait at the given rank; '' for unknown ids. */
export function traitText(id: string, rank: number): string {
  const fn = TRAIT_TEXT[id];
  if (!fn || !TRAITS[id]) return '';
  const text = fn(Math.max(1, Math.min(rank, TRAITS[id]!.ranks)));
  const cost = TRAITS[id]!.cost;
  return cost ? `${text} · 대가: ${cost}` : text;
}
