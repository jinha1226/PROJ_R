import type { Rng } from '../../core/rng';
import { WEAPONS, type WeaponId } from '../party/partyDefs';

export type Rarity = 'common' | 'fine' | 'rare';
export type ArmorId = 'cloth' | 'leather' | 'plate';
export type AffixId = 'keen' | 'quick' | 'sturdy' | 'focused' | 'vital';
export type TrinketId = 'thorns' | 'vampire' | 'swift' | 'focus' | 'bulwark' | 'executioner' | 'ember' | 'frostbite'
  | 'link_bait' | 'link_shatter' | 'link_mark' | 'link_guard' | 'link_echo';
export type Item =
  | { id: string; kind: 'weapon'; base: WeaponId; rarity: Rarity; affix?: AffixId }
  | { id: string; kind: 'armor'; base: ArmorId; rarity: Rarity; affix?: AffixId }
  | { id: string; kind: 'trinket'; base: TrinketId };
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type ItemDraft = WithoutId<Item>;
export const ARMORS: Record<ArmorId, { name: string; reduce: number; moveMul: number; atkMul: number; magicCdMul: number }> = {
  cloth: { name: '천옷', reduce: 0, moveMul: 1, atkMul: 1, magicCdMul: 0.9 },
  leather: { name: '가죽 갑옷', reduce: 0.1, moveMul: 1, atkMul: 1, magicCdMul: 1 },
  plate: { name: '판금 갑옷', reduce: 0.25, moveMul: 1.15, atkMul: 1.1, magicCdMul: 1.25 },
};
export const AFFIXES: Record<AffixId, { name: string }> = {
  keen: { name: '날카로운' }, quick: { name: '재빠른' }, sturdy: { name: '튼튼한' }, focused: { name: '집중의' }, vital: { name: '생명의' },
};
export const TRINKETS: Record<TrinketId, { name: string; link: boolean; desc: string }> = {
  thorns: { name: '가시', link: false, desc: '근접 반사' }, vampire: { name: '흡혈', link: false, desc: '타격 회복' },
  swift: { name: '질풍', link: false, desc: '공격 가속' }, focus: { name: '집중', link: false, desc: '재사용 가속' },
  bulwark: { name: '철벽', link: false, desc: '체력 증가' }, executioner: { name: '처형자', link: false, desc: '빈사 처형' },
  ember: { name: '불씨', link: false, desc: '화상' }, frostbite: { name: '동상', link: false, desc: '행동 지연' },
  link_bait: { name: '미끼', link: true, desc: '도발 약화' }, link_shatter: { name: '공명 파쇄', link: true, desc: '빙결 파쇄' },
  link_mark: { name: '사냥 표식', link: true, desc: '아군 추격' }, link_guard: { name: '수호 서약', link: true, desc: '피해 분담' },
  link_echo: { name: '메아리', link: true, desc: '기술 공명' },
};
export function itemName(it: Item): string {
  if (it.kind === 'trinket') return TRINKETS[it.base].name;
  const name = it.kind === 'weapon' ? WEAPONS[it.base].name : ARMORS[it.base].name;
  return `${it.affix ? AFFIXES[it.affix].name + ' ' : it.rarity !== 'common' ? '고급 ' : ''}${name}`;
}
export function rollItem(rng: Rng, floor: number, kind?: Item['kind'], minRarity: Rarity = 'common'): ItemDraft {
  kind ??= rng.pick(['weapon', 'armor', 'trinket']);
  if (kind === 'trinket') return { kind, base: rng.pick(Object.keys(TRINKETS) as TrinketId[]) };
  const roll = rng.next(), rare = Math.min(0.5, 0.05 + Math.max(0, floor - 1) * 0.035);
  const rarity: Rarity = minRarity === 'rare' || roll < rare ? 'rare' : minRarity === 'fine' || roll < rare + 0.25 ? 'fine' : 'common';
  const affix = rarity === 'rare' ? rng.pick(Object.keys(AFFIXES) as AffixId[]) : undefined;
  return kind === 'weapon'
    ? { kind, base: rng.pick((Object.keys(WEAPONS) as WeaponId[]).filter((w) => w !== 'fists')), rarity, affix }
    : { kind, base: rng.pick(Object.keys(ARMORS) as ArmorId[]), rarity, affix };
}
