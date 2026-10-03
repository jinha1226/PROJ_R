import { createRng } from '../../core/rng';
import type { GridState } from './types';

export type PotionKind = 'strength' | 'cure' | 'invis' | 'fire' | 'poison' | 'frost' | 'haste' | 'confuse';
export type ScrollKind = 'identify' | 'engrave' | 'teleport' | 'map' | 'fear' | 'lure' | 'recharge';
export const POTIONS: PotionKind[] = ['strength', 'cure', 'invis', 'fire', 'poison', 'frost', 'haste', 'confuse'];
export const SCROLLS: ScrollKind[] = ['identify', 'engrave', 'teleport', 'map', 'fear', 'lure', 'recharge'];
export const POTION_NAME: Record<PotionKind, string> = { strength: '힘', cure: '해독', invis: '투명', fire: '화염', poison: '독', frost: '빙결', haste: '신속', confuse: '혼란' };
export const SCROLL_NAME: Record<ScrollKind, string> = { identify: '확인', engrave: '각인', teleport: '순간이동', map: '지도', fear: '공포', lure: '소음', recharge: '재충전' };
const COLORS = ['붉은', '푸른', '초록', '노란', '보라', '주황', '검은', '하얀', '분홍', '은빛'];
const RUNES = ['조르', '칼', '벡스', '무르', '티르', '올름', '센', '라그', '페오'];

/** What this run's potion colours and scroll runes mean, and which the hero has learned. */
export interface Lore { colors: Record<PotionKind, string>; runes: Record<ScrollKind, string>; known: string[] }

/** A fresh shuffle for a run, on its own dice so the run's other rolls stay put. */
export function newLore(seed: number): Lore {
  const rng = createRng((seed ^ 0x2c1b3c6d) >>> 0);
  const c = rng.shuffle([...COLORS]);
  const r = rng.shuffle([...RUNES]);
  return {
    colors: Object.fromEntries(POTIONS.map((k, i) => [k, c[i]!])) as Record<PotionKind, string>,
    runes: Object.fromEntries(SCROLLS.map((k, i) => [k, r[i]!])) as Record<ScrollKind, string>,
    known: [],
  };
}

export const potionKey = (k: PotionKind) => `potion:${k}`;
export const scrollKey = (k: ScrollKind) => `scroll:${k}`;
export const isKnown = (s: GridState, key: string): boolean => s.lore.known.includes(key);

export function potionName(s: GridState, k: PotionKind): string {
  return isKnown(s, potionKey(k)) ? `${POTION_NAME[k]} 물약` : `${s.lore.colors[k]} 물약`;
}

export function scrollName(s: GridState, k: ScrollKind): string {
  return isKnown(s, scrollKey(k)) ? `${SCROLL_NAME[k]} 주문서` : `「${s.lore.runes[k]}」 주문서`;
}

/** Learns what a kind is for the rest of the run (the event carries the old and new names). */
export function identify(s: GridState, key: string, t: number): void {
  if (isKnown(s, key)) return;
  const [type, k] = key.split(':') as ['potion' | 'scroll', string];
  const before = type === 'potion' ? potionName(s, k as PotionKind) : scrollName(s, k as ScrollKind);
  s.lore.known.push(key);
  const after = type === 'potion' ? potionName(s, k as PotionKind) : scrollName(s, k as ScrollKind);
  s.events.push({ t, type: 'identify', src: s.hero.id, text: `${before}|${after}` });
}
