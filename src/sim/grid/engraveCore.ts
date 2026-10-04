import type { Family } from './engraveDefs';
import { activeWeapon } from './gear';
import { isGun, WEAPONS, type Element } from './items';
import type { Ent, GridState } from './types';

export type EngraveId =
  | 'dash' | 'finisher' | 'shoveShot' | 'leap' | 'counter' | 'riposte'
  | 'momentum' | 'quickswap' | 'swapstrike' | 'wallslam' | 'laststand'
  | 'rapid' | 'mark' | 'ricochet' | 'kite' | 'volley'
  | 'gunRelay' | 'bladeRelay' | 'spinShot' | 'counterShot' | 'execute' | 'flow'
  | 'alternate' | 'echo' | 'chain' | 'elemArrow';
export const SUIT_SLOTS = 6;
export type Fit = 'melee' | 'ranged' | 'magic' | 'any' | 'kata';

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
  alternate: { name: '교대 시전', note: '다른 원소 시전 → ×1.5 · 시간 절반', fits: 'magic', base: true, cost: 60, family: 'element', tags: ['원소'] },
  echo: { name: '잔향', note: '3번째 주문 → 재시전', fits: 'magic', base: true, cost: 60, family: 'element', tags: ['원소'] },
  chain: { name: '연쇄 번개', note: '전격 → 두 번 도약', fits: 'magic', base: true, cost: 60, family: 'element', tags: ['원소'] },
  elemArrow: { name: '원소 탄', note: '원소 시전 → 다음 총탄에 원소', fits: 'magic', base: true, cost: 60, family: 'element', tags: ['원소'] },
  gunRelay: { name: '총 연계', note: '칼 처치 → 최근접 사격', fits: 'kata', base: true, cost: 60, family: 'fusion', tags: ['처치'] },
  bladeRelay: { name: '칼 연계', note: '총 처치 → 2칸 돌진 베기', fits: 'kata', base: true, cost: 60, family: 'fusion', tags: ['처치', '돌진'] },
  spinShot: { name: '회전 사격', note: '다수 인접 베기 → 주변 사격', fits: 'kata', base: true, cost: 90, family: 'fusion', tags: ['포위'] },
  counterShot: { name: '반격 사격', note: '회피 → 반격 사격', fits: 'any', base: true, cost: 70, family: 'fusion', tags: ['회피'] },
  execute: { name: '처형', note: '인접 기절 → 처형', fits: 'any', base: true, cost: 90, family: 'fusion', tags: ['기절', '처치'] },
  flow: { name: '흐름', note: '각인 연쇄 → 다음 행동 0턴', fits: 'any', base: true, cost: 120, family: 'fusion', tags: ['연쇄'] },
};
export const ENGRAVE_IDS = Object.keys(ENGRAVES) as EngraveId[];

export const BASE_IDS: EngraveId[] = ENGRAVE_IDS.filter(id => ENGRAVES[id].base);

/** Per-run combo memory on the hero. */
export interface HeroFx {
  combo: { target?: string; hits: number };
  rapid: { target?: string; n: number };
  shots: number;
  spells: number;
  lastEl?: Element;
  arrowEl?: Element;
  nextMult: number;
  momentum: boolean;
  free: boolean;
  /** what the current hero action was (a blow keeps the melee combo, a shot the rapid chain) */
  acted: 'melee' | 'shot' | null;
  /** quick swap pays out once per attack (a blow or a shot re-arms it) */
  swapReady: boolean;
}
export const freshFx = (): HeroFx => ({ combo: { hits: 0 }, rapid: { n: 0 }, shots: 0, spells: 0, nextMult: 1, momentum: false, free: false, acted: null, swapReady: true });

/** Whether the active hand fits this engraving's family. */
export function fitsHand(s: GridState, id: EngraveId): boolean {
  const fit = ENGRAVES[id].fits;
  const w = activeWeapon(s.hero.gear);
  if (fit === 'kata') return s.hero.gear.hands.some(w => w && WEAPONS[w.group].melee) && s.hero.gear.hands.some(w => w && isGun(w.group));
  if (fit === 'any') return true;
  if (!w) return false;
  return fit === 'melee' ? WEAPONS[w.group].melee : fit === 'ranged' ? isGun(w.group) : w.group === 'staff';
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
