import { activeWeapon } from './gear';
import { isGun, WEAPONS, type Element } from './items';
import type { Ent, GridState } from './types';

export type EngraveId =
  | 'dash' | 'finisher' | 'shoveShot' | 'leap' | 'counter' | 'riposte'
  | 'momentum' | 'quickswap' | 'swapstrike' | 'wallslam' | 'laststand'
  | 'rapid' | 'mark' | 'ricochet' | 'kite' | 'volley'
  | 'alternate' | 'echo' | 'chain' | 'elemArrow';
export const SUIT_SLOTS = 6;
export type Fit = 'melee' | 'ranged' | 'magic' | 'any';

/** Name, one line, and which weapons it suits (for absorption and scroll offers). */
export const ENGRAVES: Record<EngraveId, { name: string; note: string; fits: Fit }> = {
  dash: { name: '돌진 베기', note: '2칸 앞 적에게 뛰어들며 벤다', fits: 'melee' },
  finisher: { name: '3연타 마무리', note: '같은 적 3타째 ×1.5 + 밀치기', fits: 'melee' },
  shoveShot: { name: '밀치고 쏘기', note: '벤 적을 밀치고 다른 손 총으로 한 발', fits: 'melee' },
  leap: { name: '도약 내려찍기', note: '3칸 앞 적에게 도약, 착지 주변 공격', fits: 'melee' },
  counter: { name: '반격', note: '회피하면 바로 반격', fits: 'melee' },
  riposte: { name: '되받아치기', note: '패링하면 바로 반격', fits: 'melee' },
  momentum: { name: '기세', note: '처치하면 다음 행동 시간 절반', fits: 'any' },
  quickswap: { name: '칼바꿈', note: '무기 종류를 바꾸면 0턴, 다음 공격 +50%', fits: 'any' },
  swapstrike: { name: '연환', note: '교체 후 든 무기로 즉시 공격', fits: 'any' },
  wallslam: { name: '벽치기', note: '벽에 박으면 주변 충격파', fits: 'melee' },
  laststand: { name: '배수진', note: '체력 30% 이하 피해 +40%', fits: 'any' },
  rapid: { name: '연사', note: '같은 적 연속 사격: 빨라지고 3발째 치명', fits: 'ranged' },
  mark: { name: '표식', note: '맞힌 적 받는 피해 +30%, 처치 시 옮겨붙음', fits: 'ranged' },
  ricochet: { name: '도탄', note: '처치한 사격이 근처 적에게 튕김', fits: 'ranged' },
  kite: { name: '쏘고 물러나기', note: '붙은 적을 쏘면 한 칸 물러남', fits: 'ranged' },
  volley: { name: '삼중 사격', note: '3번째 사격마다 두 발 더', fits: 'ranged' },
  alternate: { name: '교대 시전', note: '직전과 다른 원소: ×1.5, 시간 절반', fits: 'magic' },
  echo: { name: '잔향', note: '3번째 주문마다 한 번 더', fits: 'magic' },
  chain: { name: '연쇄 번개', note: '번개가 두 번 튄다', fits: 'magic' },
  elemArrow: { name: '원소 탄', note: '마지막 원소가 다음 총탄에 실림', fits: 'magic' },
};
export const ENGRAVE_IDS = Object.keys(ENGRAVES) as EngraveId[];

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
  /** what the current hero action was (a blow keeps the melee combo, a shot the rapid chain) */
  acted: 'melee' | 'shot' | null;
}
export const freshFx = (): HeroFx => ({ combo: { hits: 0 }, rapid: { n: 0 }, shots: 0, spells: 0, nextMult: 1, momentum: false, acted: null });

/** Whether the active hand fits this engraving's family. */
export function fitsHand(s: GridState, id: EngraveId): boolean {
  const fit = ENGRAVES[id].fits;
  const w = activeWeapon(s.hero.gear);
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
