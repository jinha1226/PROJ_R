import type { UltId } from '../../sim/party/classKit';

/** What each class's ultimate does, in a few terse words (numbers as the code has them). */
export const ULT_TEXT: Record<UltId, string> = {
  warcry: '4칸 안 적 5턴 도발 · 아군 보호막 15',
  golem: '지정한 칸 주변 3칸의 시체를 모아 골렘 소환(시체 수만큼 단단함), 주변 적을 끌어당기고 쓰러지면 대폭발',
  teleport: '지정한 칸으로 순간이동, 출발·도착 지점 주변 1칸에 다음 원소 폭발',
  gravity: '지정한 칸으로 2턴간 3칸 안 적을 끌어당긴 뒤 붕괴 (주변 1칸 피해·기절)',
  bastion: '4칸 안 적 5턴 도발 · 아군 보호막 30',
  bloodFrenzy: '5턴간 준 피해의 30% 회복',
  sanctum: '지정한 칸(6칸 안) 주변 2칸에 3턴 결계: 안의 아군 무적, 적은 매 턴 신성 피해',
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
  earthSlam: '지정한 칸(5칸 안)으로 도약해 내려찍기: 주변 2칸 기절 + 회오리 베기',
  shadowClone: '지정한 칸에 분신 둘 (3턴, 내 공격을 따라 함, 한 대 맞으면 사라짐)',
  deathDance: '4칸 안 적 6명에게 순간이동 베기 (피해 2배)',
};
