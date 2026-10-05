import type { Family } from './engraveDefs';
import { activeWeapon } from './gear';
import { isGun, WEAPONS, type Element } from './items';
import type { Ent, GridState } from './types';

export type EngraveId =
  | 'dash' | 'finisher' | 'shoveShot' | 'leap' | 'counter' | 'riposte'
  | 'momentum' | 'quickswap' | 'swapstrike' | 'wallslam' | 'laststand'
  | 'rapid' | 'mark' | 'ricochet' | 'kite' | 'volley'
  | 'gunRelay' | 'bladeRelay' | 'spinShot' | 'counterShot' | 'execute' | 'flow'
  | 'alternate' | 'echo' | 'chain' | 'elemArrow'
  | 'bloodlust' | 'fury' | 'shoulder' | 'ironwall' | 'cull' | 'tempest' | 'gale' | 'rebound'
  | 'quickdraw' | 'pierce' | 'sniper' | 'headshot' | 'covering' | 'suppress' | 'barrage' | 'thrift' | 'steady'
  | 'bayonet' | 'reverseCut' | 'reclaim' | 'muzzleShove' | 'executionRush' | 'trance'
  | 'fireSpread' | 'fireBlade' | 'fireStoke' | 'fireEmber'
  | 'frostShatter' | 'frostVeil' | 'frostBite' | 'frostSnap'
  | 'shockArc' | 'shockCharge' | 'shockCut' | 'shockDischarge'
  | 'poisonBurst' | 'poisonVenom' | 'poisonParalyze' | 'poisonSiphon';
export const SUIT_SLOTS = 6;
export type Fit = 'melee' | 'ranged' | 'any' | 'kata';

/** Name, one line, and which weapons it suits (for absorption and scroll offers). */
export const ENGRAVES: Record<EngraveId, { name: string; note: string; fits: Fit; base: boolean; cost: number; family: Family; tags: string[] }> = {
  dash: { name: '돌진 베기', note: '2칸 앞 적 → 돌진 베기', fits: 'melee', base: true, cost: 50, family: 'melee', tags: ['돌진'] },
  finisher: { name: '3연타 마무리', note: '같은 적 3타 → ×1.5 · 밀치기', fits: 'melee', base: true, cost: 40, family: 'melee', tags: ['연타'] },
  shoveShot: { name: '밀치고 쏘기', note: '칼 명중 → 밀치기 · 반대 손 사격', fits: 'melee', base: true, cost: 50, family: 'fusion', tags: ['밀치기'] },
  leap: { name: '도약 내려찍기', note: '3칸 앞 적 → 도약 · 주변 베기', fits: 'melee', base: true, cost: 60, family: 'melee', tags: ['돌진'] },
  counter: { name: '반격', note: '회피 → 반격', fits: 'melee', base: true, cost: 60, family: 'melee', tags: ['회피'] },
  riposte: { name: '되받아치기', note: '패링 → 반격 · 기절', fits: 'melee', base: true, cost: 70, family: 'melee', tags: ['패링', '기절'] },
  momentum: { name: '기세', note: '처치 → 다음 행동 시간 절반', fits: 'any', base: true, cost: 80, family: 'fusion', tags: ['처치'] },
  quickswap: { name: '칼바꿈', note: '무기 종류 교체 → 0턴 · 다음 공격 +50%', fits: 'any', base: true, cost: 60, family: 'fusion', tags: ['교체'] },
  swapstrike: { name: '연환', note: '교체 → 즉시 공격', fits: 'any', base: true, cost: 50, family: 'fusion', tags: ['교체'] },
  wallslam: { name: '벽치기', note: '벽 충돌 → 주변 충격파', fits: 'melee', base: true, cost: 50, family: 'melee', tags: ['밀치기', '기절'] },
  laststand: { name: '배수진', note: '체력 30% 이하 → 피해 +40%', fits: 'any', base: true, cost: 50, family: 'melee', tags: ['위기'] },
  rapid: { name: '연사', note: '연속 사격 → 가속 · 3발째 치명', fits: 'ranged', base: true, cost: 50, family: 'ranged', tags: ['연사'] },
  mark: { name: '표식', note: '명중 → 피해 +30% 표식 · 처치 시 전이', fits: 'ranged', base: true, cost: 60, family: 'ranged', tags: ['표식'] },
  ricochet: { name: '도탄', note: '사격 처치 → 근처 적 도탄', fits: 'ranged', base: true, cost: 60, family: 'ranged', tags: ['처치'] },
  kite: { name: '쏘고 물러나기', note: '인접 사격 → 한 칸 후퇴', fits: 'ranged', base: true, cost: 40, family: 'ranged', tags: ['회피'] },
  volley: { name: '삼중 사격', note: '3번째 사격 → 두 발 추가', fits: 'ranged', base: true, cost: 70, family: 'ranged', tags: ['연사'] },
  alternate: { name: '교대 탄', note: '두 원소 번갈아 → 피해 ×1.5', fits: 'any', base: true, cost: 60, family: 'element', tags: ['원소'] },
  echo: { name: '잔향 탄', note: '3발째 → 원소 한 번 더', fits: 'any', base: true, cost: 60, family: 'element', tags: ['원소'] },
  chain: { name: '연쇄 반응', note: '원소 반응 → 옆 칸으로 번짐', fits: 'any', base: true, cost: 60, family: 'element', tags: ['원소'] },
  elemArrow: { name: '원소 칼날', note: '칼 타격 → 장전 원소 부여', fits: 'any', base: true, cost: 60, family: 'element', tags: ['원소'] },
  gunRelay: { name: '총 연계', note: '칼 처치 → 최근접 사격', fits: 'kata', base: true, cost: 60, family: 'fusion', tags: ['처치'] },
  bladeRelay: { name: '칼 연계', note: '총 처치 → 2칸 돌진 베기', fits: 'kata', base: true, cost: 60, family: 'fusion', tags: ['처치', '돌진'] },
  spinShot: { name: '회전 사격', note: '다수 인접 베기 → 주변 사격', fits: 'kata', base: true, cost: 90, family: 'fusion', tags: ['포위'] },
  counterShot: { name: '반격 사격', note: '회피 → 반격 사격', fits: 'any', base: true, cost: 70, family: 'fusion', tags: ['회피'] },
  execute: { name: '처형', note: '인접 기절 → 처형', fits: 'any', base: true, cost: 90, family: 'fusion', tags: ['기절', '처치'] },
  flow: { name: '흐름', note: '각인 연쇄 → 다음 행동 0턴', fits: 'any', base: true, cost: 120, family: 'fusion', tags: ['연쇄'] },
  bloodlust: { name: '피의 갈증', note: '칼 처치 → 체력 +2', fits: 'melee', base: true, cost: 50, family: 'melee', tags: ['처치', '회복'] },
  fury: { name: '광폭', note: '칼 처치 → 다음 공격 ×1.5', fits: 'melee', base: true, cost: 60, family: 'melee', tags: ['처치'] },
  shoulder: { name: '어깨치기', note: '이동 직후 근접 → 밀치기', fits: 'melee', base: true, cost: 50, family: 'melee', tags: ['밀치기'] },
  ironwall: { name: '철벽', note: '패링 → 보호막 3', fits: 'melee', base: true, cost: 60, family: 'melee', tags: ['패링', '방어'] },
  cull: { name: '처단', note: '체력 30% 이하 적 근접 → 처치', fits: 'melee', base: true, cost: 90, family: 'melee', tags: ['처치'] },
  tempest: { name: '칼날 폭풍', note: '포위 → 붙은 적 전부 베기', fits: 'melee', base: true, cost: 90, family: 'melee', tags: ['포위'] },
  gale: { name: '질풍', note: '칼로 둘 이상 처치 → 다음 행동 0턴', fits: 'melee', base: true, cost: 100, family: 'melee', tags: ['처치'] },
  rebound: { name: '반동', note: '벽에 박음 → 충전 +2', fits: 'melee', base: true, cost: 50, family: 'melee', tags: ['기절'] },
  quickdraw: { name: '속사', note: '사격 처치 → 충전 +1', fits: 'ranged', base: true, cost: 50, family: 'ranged', tags: ['처치'] },
  pierce: { name: '관통탄', note: '사격 → 뒤의 적 하나 더', fits: 'ranged', base: true, cost: 70, family: 'ranged', tags: ['관통'] },
  sniper: { name: '저격', note: '4칸 이상 사격 → ×1.5', fits: 'ranged', base: true, cost: 60, family: 'ranged', tags: ['거리'] },
  headshot: { name: '헤드샷', note: '무상처 적 첫 사격 → 치명', fits: 'ranged', base: true, cost: 80, family: 'ranged', tags: ['치명'] },
  covering: { name: '엄호 사격', note: '회피 → 다음 사격 0턴', fits: 'ranged', base: true, cost: 70, family: 'ranged', tags: ['회피'] },
  suppress: { name: '견제', note: '사격 명중 → 적 행동 지연', fits: 'ranged', base: true, cost: 60, family: 'ranged', tags: ['지연'] },
  barrage: { name: '탄막', note: '연쇄 → 보이는 적마다 한 발', fits: 'ranged', base: true, cost: 120, family: 'ranged', tags: ['연쇄'] },
  thrift: { name: '절약', note: '사격 처치 → 충전 환급', fits: 'ranged', base: true, cost: 60, family: 'ranged', tags: ['처치'] },
  steady: { name: '조준', note: '대기 후 사격 → 치명', fits: 'ranged', base: true, cost: 50, family: 'ranged', tags: ['치명'] },
  bayonet: { name: '총검', note: '칼 타격 → 같은 적에게 한 발', fits: 'kata', base: true, cost: 70, family: 'fusion', tags: ['연계'] },
  reverseCut: { name: '역수 베기', note: '붙은 적 사격 → 칼로 한 번', fits: 'kata', base: true, cost: 70, family: 'fusion', tags: ['연계'] },
  reclaim: { name: '칼날 회수', note: '칼 처치 → 충전 +1', fits: 'kata', base: true, cost: 40, family: 'fusion', tags: ['처치'] },
  muzzleShove: { name: '총구 밀치기', note: '총 타격 → 밀치기', fits: 'kata', base: true, cost: 40, family: 'fusion', tags: ['밀치기'] },
  executionRush: { name: '처형 연계', note: '처형 → 충전 +2', fits: 'kata', base: true, cost: 60, family: 'fusion', tags: ['기절', '처치'] },
  trance: { name: '무아지경', note: '칼·총 둘 다 처치 → 체력 +3', fits: 'kata', base: true, cost: 80, family: 'fusion', tags: ['연쇄', '회복'] },
  fireSpread: { name: '화염 확산', note: '불붙은 적 처치 → 주변 화상', fits: 'any', base: true, cost: 70, family: 'element', tags: ['화염'] },
  fireBlade: { name: '불길 베기', note: '불붙은 적 근접 → ×1.5', fits: 'any', base: true, cost: 60, family: 'element', tags: ['화염'] },
  fireStoke: { name: '소각', note: '화상 피해 → +1', fits: 'any', base: true, cost: 50, family: 'element', tags: ['화염'] },
  fireEmber: { name: '불씨', note: '불붙은 적 사격 처치 → 충전 +1', fits: 'any', base: true, cost: 50, family: 'element', tags: ['화염'] },
  frostShatter: { name: '빙결 파쇄', note: '얼어붙은 적 근접 → ×2 · 해빙', fits: 'any', base: true, cost: 90, family: 'element', tags: ['빙결'] },
  frostVeil: { name: '서리 장막', note: '빙결 부여 → 보호막 2', fits: 'any', base: true, cost: 60, family: 'element', tags: ['빙결'] },
  frostBite: { name: '동상', note: '얼어붙은 적 사격 → ×1.3', fits: 'any', base: true, cost: 50, family: 'element', tags: ['빙결'] },
  frostSnap: { name: '한파', note: '연쇄 → 붙은 적 빙결', fits: 'any', base: true, cost: 90, family: 'element', tags: ['빙결'] },
  shockArc: { name: '전격 연쇄', note: '전격 → 한 번 더 튐', fits: 'any', base: true, cost: 70, family: 'element', tags: ['전격'] },
  shockCharge: { name: '과충전', note: '전격 부여 → 충전 +1', fits: 'any', base: true, cost: 60, family: 'element', tags: ['전격'] },
  shockCut: { name: '감전 베기', note: '근접 → 전격 부여', fits: 'any', base: true, cost: 60, family: 'element', tags: ['전격'] },
  shockDischarge: { name: '방전', note: '회피 → 주변 전격', fits: 'any', base: true, cost: 80, family: 'element', tags: ['전격'] },
  poisonBurst: { name: '독 폭발', note: '중독된 적 처치 → 독구름', fits: 'any', base: true, cost: 70, family: 'element', tags: ['독'] },
  poisonVenom: { name: '맹독', note: '칼 타격 → 독 2배', fits: 'any', base: true, cost: 60, family: 'element', tags: ['독'] },
  poisonParalyze: { name: '마비독', note: '중독된 적 기절 → 기절 +1', fits: 'any', base: true, cost: 70, family: 'element', tags: ['독'] },
  poisonSiphon: { name: '해독 흡수', note: '독 피해 → 체력 +1', fits: 'any', base: true, cost: 60, family: 'element', tags: ['독'] },
};
export const ENGRAVE_IDS = Object.keys(ENGRAVES) as EngraveId[];

export const BASE_IDS: EngraveId[] = ENGRAVE_IDS.filter(id => ENGRAVES[id].base);

/** Per-run combo memory on the hero. */
export interface HeroFx {
  combo: { target?: string; hits: number };
  rapid: { target?: string; n: number };
  /** Last integer simulation turn healed by poison ticks; absent in old saves. */
  poisonSiphonTurn?: number;
  shots: number;
  roundShots: number;
  lastEl?: Element;
  nextMult: number;
  momentum: boolean;
  free: boolean;
  /** Covering banks a shot, so moves and waits do not spend it. */
  freeShot?: boolean;
  /** what the current hero action was (a blow keeps the melee combo, a shot the rapid chain) */
  acted: 'melee' | 'shot' | null;
  /** quick swap pays out once per attack (a blow or a shot re-arms it) */
  swapReady: boolean;
  /** Previous completed gameplay action; absent in old saves. */
  lastAction?: 'move' | 'wait' | 'other';
  /** Unique kills attributed to each attack kind in this action. */
  kills?: { melee: string[]; gun: string[] };
}
export const freshFx = (): HeroFx => ({ combo: { hits: 0 }, rapid: { n: 0 }, shots: 0, roundShots: 0, nextMult: 1, momentum: false, free: false, acted: null, swapReady: true });

/** Whether the active hand fits this engraving's family. */
export function fitsHand(s: GridState, id: EngraveId): boolean {
  const fit = ENGRAVES[id].fits;
  const w = activeWeapon(s.hero.gear);
  if (fit === 'kata') return s.hero.gear.hands.some(w => w && WEAPONS[w.group].melee) && s.hero.gear.hands.some(w => w && isGun(w.group));
  if (fit === 'any') return true;
  if (!w) return false;
  return fit === 'melee' ? WEAPONS[w.group].melee : isGun(w.group);
}

/** A suit engraving is active only while the hand fits it. */
export function has(s: GridState, id: EngraveId): boolean {
  return s.hero.suit.includes(id) && fitsHand(s, id);
}

/** Marks an engraving as fired this action (false if it already did — each fires once per action). */
export function fire(s: GridState, t: number, id: EngraveId): boolean {
  if (s.fired.has(id)) return false;
  s.fired.add(id);
  s.events.push({ t, type: 'engrave', src: s.hero.id, text: id });
  return true;
}

const MARK_MULT = 1.3;
const LAST_STAND = 1.4;
const LOW_HP = 0.3;

/** Engraving boosts on one of the hero's blows or shots: a marked foe, last stand, a quick-swap charge. */
export function blowMult(s: GridState, t: number, foe: Ent): number {
  const h = s.hero;
  let m = h.fx.nextMult * (foe.marked ? MARK_MULT : 1);
  if (h.hp <= h.maxHp * LOW_HP && has(s, 'laststand')) { fire(s, t, 'laststand'); m *= LAST_STAND; }
  return m;
}
