import type { ClassId, FoeId, SkillId } from '../../sim/party/partyDefs';

/** A small line emblem per class (24×24 viewBox, drawn in the current colour). */
const PATH: Record<ClassId, string> = {
  shell: '<circle cx="12" cy="12" r="7" fill="none" stroke-dasharray="3 3"/>',
  warrior: '<path d="M6 18 L16 8 M14 6 L18 10 M5 15 L9 19"/><path d="M15 14 l4 0 l0 4 q-2 2 -4 0 z" />',
  berserker: '<path d="M7 19 L15 7 M12 5 q6 1 6 7 q-3 -3 -6 -7 z M9 19 L17 7"/>',
  archer: '<path d="M8 4 q10 8 0 16"/><path d="M8 4 L8 20 M5 12 L19 12 M16 10 L19 12 L16 14"/>',
  sniper: '<circle cx="12" cy="12" r="6" fill="none"/><path d="M12 3 V8 M12 16 V21 M3 12 H8 M16 12 H21"/>',
  mage: '<path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z"/>',
  cleric: '<path d="M12 4 V20 M6 9 H18"/><circle cx="12" cy="9" r="7" fill="none" stroke-opacity="0.5"/>',
  rogue: '<path d="M6 18 L15 9 L18 4 L13 7 L4 16 Z M5 15 L9 19"/>',
};

export function classIcon(cls: ClassId): string {
  return `<svg class="cls-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATH[cls]}</svg>`;
}

/** the colour that marks each class on the frames */
export const CLASS_TINT: Record<ClassId, string> = {
  shell: '#9aa4b0', warrior: '#7aa8ff', berserker: '#ff7a5a', archer: '#8fdc6a', sniper: '#c8d070',
  mage: '#c890ff', cleric: '#ffd76a', rogue: '#ff6a8a',
};

/** what each skill does, in a few words */
export const SKILL_DESC: Record<SkillId, string> = {
  taunt: '주변 적이 5초간 나를 노림', whirl: '곁의 적 모두 베기', pierce: '일직선 관통 사격', volley: '세 발 연속 사격',
  fireball: '폭발 · 주변까지 화상', frost: '대상을 얼려 묶음', heal: '가장 다친 아군 회복', ward: '주변 아군 보호막',
  stealth: '4초 은신 · 다음 공격 2.5배', backstab: '대상 곁으로 순간이동해 2배 찌르기', frenzy: '5초간 공격 속도 2배', aimed: '강력한 한 발',
};

export const FOE_NAME: Record<FoeId, string> = { goblin: '고블린', archer: '고블린 궁수', brute: '오우거' };
