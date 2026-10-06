import type { BaseClass } from './partyDefs';

/** what a level-up can offer: a few for every class, two of its own for each */
export type TraitId = 'tough' | 'sprint' | 'eagle' | 'coverPro' | 'firstAid' | 'bond' | 'grit' | 'resonance'
  | 'shieldPro' | 'riposte' | 'rapid' | 'steady' | 'amplify' | 'flow' | 'blessing' | 'warding' | 'shadow' | 'vital';

export interface TraitDef { name: string; ranks: [string, string, string]; cls?: BaseClass }

export const MAX_RANK = 3;
/** the advanced class opens from this level (if its condition is met) */
export const PROMOTE_LEVEL = 8;

export const TRAITS: Record<TraitId, TraitDef> = {
  tough: { name: '강인함', ranks: ['최대 체력 +15%', '최대 체력 +30%', '최대 체력 +45%'] },
  sprint: { name: '질주', ranks: ['이동 +10%', '이동 +20%', '이동 +30% · 회피 15%'] },
  eagle: { name: '매의 눈', ranks: ['원거리 명중 +5%', '원거리 명중 +10%', '원거리 명중 +15% · 사거리 +1'] },
  coverPro: { name: '엄폐 숙련', ranks: ['엄폐 중 원거리 피해 -15%', '-30%', '-45%'] },
  firstAid: { name: '응급처치', ranks: ['전투 밖 초당 회복 1%', '2%', '3%'] },
  bond: { name: '결속', ranks: ['곁의 아군 하나당 피해 +5%', '+10%', '+15%'] },
  grit: { name: '끈기', ranks: ['죽을 피해를 체력 1로 버팀 · 60초', '40초', '20초'] },
  resonance: { name: '영혼 공명', ranks: ['기술 대기 -10%', '-20%', '-30%'] },
  shieldPro: { name: '방패 숙련', cls: 'warrior', ranks: ['근접 공격 막기 10%', '20%', '30%'] },
  riposte: { name: '반격 강화', cls: 'warrior', ranks: ['반격 확률 +15%', '+30%', '+45%'] },
  rapid: { name: '속사', cls: 'archer', ranks: ['공격 속도 +10%', '+20%', '+30%'] },
  steady: { name: '저격 자세', cls: 'archer', ranks: ['제자리 사격마다 +10% (최대 30%)', '최대 60%', '최대 90%'] },
  amplify: { name: '원소 증폭', cls: 'mage', ranks: ['기술 피해 +15%', '+30%', '+45%'] },
  flow: { name: '마력 순환', cls: 'mage', ranks: ['처치 시 기술 대기 -1초', '-2초', '-3초'] },
  blessing: { name: '축복', cls: 'cleric', ranks: ['치유량 +20%', '+40%', '+60%'] },
  warding: { name: '수호의 빛', cls: 'cleric', ranks: ['보호막 +5', '+10', '+15'] },
  shadow: { name: '그림자 걸음', cls: 'rogue', ranks: ['은신 +1초', '+2초', '+3초'] },
  vital: { name: '급소 공략', cls: 'rogue', ranks: ['치명 10% (1.5배)', '20%', '30%'] },
};

/** the rank (0–3) a unit holds in a trait */
export const rank = (u: { traits?: Partial<Record<TraitId, number>> }, id: TraitId): number => u.traits?.[id] ?? 0;
type Holder = { traits?: Partial<Record<TraitId, number>> };
/** multipliers and chances the traits give (1 or 0 for a unit without them) */
export const T = {
  hp: (u: Holder) => 1 + 0.15 * rank(u, 'tough'),
  move: (u: Holder) => 1 - 0.1 * rank(u, 'sprint'),
  evade: (u: Holder) => (rank(u, 'sprint') >= 3 ? 0.15 : 0),
  hit: (u: Holder) => 0.05 * rank(u, 'eagle'),
  range: (u: Holder) => (rank(u, 'eagle') >= 3 ? 1 : 0),
  coverTaken: (u: Holder) => 1 - 0.15 * rank(u, 'coverPro'),
  regen: (u: Holder) => 0.01 * rank(u, 'firstAid'),
  bond: (u: Holder) => 0.05 * rank(u, 'bond'),
  gritCd: (u: Holder) => [0, 60, 40, 20][rank(u, 'grit')]!,
  cd: (u: Holder) => 1 - 0.1 * rank(u, 'resonance'),
  block: (u: Holder) => 0.1 * rank(u, 'shieldPro'),
  counter: (u: Holder) => 0.25 + 0.15 * rank(u, 'riposte'),
  atk: (u: Holder) => 1 - 0.1 * rank(u, 'rapid'),
  steadyMax: (u: Holder) => 3 * rank(u, 'steady'),
  amplify: (u: Holder) => 1 + 0.15 * rank(u, 'amplify'),
  flow: (u: Holder) => rank(u, 'flow'),
  heal: (u: Holder) => 1 + 0.2 * rank(u, 'blessing'),
  ward: (u: Holder) => 5 * rank(u, 'warding'),
  stealth: (u: Holder) => rank(u, 'shadow'),
  crit: (u: Holder) => 0.1 * rank(u, 'vital'),
};
