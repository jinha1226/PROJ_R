import type { UltId } from '../../sim/party/classKit';

/** What each class's ultimate does, in a few terse words (numbers as the code has them). */
export const ULT_TEXT: Record<UltId, string> = {
  warcry: '4칸 안 적 5턴 도발 · 아군 보호막 15',
  bastion: '4칸 안 적 5턴 도발 · 아군 보호막 30',
  bloodFrenzy: '5턴간 준 피해의 30% 회복',
  sanctum: '3칸 안 아군 3턴 무적',
  longSanctum: '3칸 안 아군 5턴 무적',
  arrowRain: '대상 주변 1칸에 화살 5발',
  bleedRain: '대상 주변 1칸에 화살 5발 · 출혈',
  meteor: '대상 주변 2칸 피해 24-32 · 화상',
  elementStorm: '대상 주변 2칸 피해 24-32 · 화상·냉기·감전',
  judgement: '대상 주변 2칸 피해 22 · 기절',
  toxicFog: '대상 주변 2칸 중독 5중첩',
  pierceShot: '일직선 관통 피해 18-24',
  deadHost: '6칸 안 시체를 해골로 일으킴 (최대 3)',
  shadowDance: '4칸 안 적 4명에게 순간이동 베기 (피해 2배)',
  deathDance: '4칸 안 적 6명에게 순간이동 베기 (피해 2배)',
};
