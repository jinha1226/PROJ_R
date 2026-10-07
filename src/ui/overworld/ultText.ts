import type { UltId } from '../../sim/party/classKit';

/** What each class's ultimate does, in a few terse words (numbers as the code has them). */
export const ULT_TEXT: Record<UltId, string> = {
  golem: '지정한 칸 주변 3칸의 시체를 모아 골렘 소환(시체 수만큼 단단함), 주변 적을 끌어당기고 쓰러지면 대폭발',
  teleport: '지정한 칸으로 순간이동, 출발·도착 지점 주변 1칸에 다음 원소 폭발',
  gravity: '지정한 칸으로 2턴간 3칸 안 적을 끌어당긴 뒤 붕괴 (주변 1칸 피해·기절)',
  sanctum: '지정한 칸(6칸 안) 주변 2칸에 3턴 결계: 안의 아군 무적, 적은 매 턴 신성 피해',
  arrowRain: '대상 주변 1칸에 화살 5발',
  earthSlam: '지정한 칸(5칸 안)으로 도약해 내려찍기: 주변 2칸 기절 + 회오리 베기',
  shadowClone: '지정한 칸에 분신 둘 (3턴, 내 공격을 따라 함, 한 대 맞으면 사라짐)',
};
